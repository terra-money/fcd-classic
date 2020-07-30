import { exec } from 'child_process'
import * as Bluebird from 'bluebird'
import got from 'got'
import { get } from 'lodash'
import { getRepository, FindConditions } from 'typeorm'

import config from 'config'
import { BlockEntity } from 'orm'

import {
  COLLECTOR_PM2_PROCESS_NAME,
  CHAIN_ID,
  BLOCK_SYNC_RESTART_THRESHOLD,
  BLOCK_SYNC_ALERT_THRESHOLD,
  COLLECTOR_RESTART_TIME_GAP
} from './constants'
import { create, update } from './pagerduty'

const incidentId = {
  block: undefined,
  tx: undefined
}

let restartTimestamp: number | undefined

const alert = async (errorType: string, title: string): Promise<void> => {
  if (incidentId[errorType]) {
    console.log('Incident already exists.')
    return
  }

  const res = await create(title)
  const id = get(res, 'incident.id')
  incidentId[errorType] = id
}

const restartCollector = (now): void => {
  if (!restartTimestamp || now - restartTimestamp > COLLECTOR_RESTART_TIME_GAP) {
    exec(`pm2 restart ${COLLECTOR_PM2_PROCESS_NAME}`, (err, stdout) => {
      console.log(`Collector has restarted, ${stdout}`)
      restartTimestamp = now
    })
  }
}

const resolve = async (errorType: string): Promise<void> => {
  if (incidentId[errorType]) {
    await update(incidentId[errorType], 'resolved')
  }

  incidentId[errorType] = undefined
}

const isBlockCorrectlySynced = async (lastSavedBlock: BlockEntity): Promise<boolean> => {
  console.log('correctly synced')
  const latestBlock = await got.get(`${config.LCD_URI}/blocks/latest`).json()
  const latestHeight = get(latestBlock, 'block.header.height')
  const syncGap = latestHeight - lastSavedBlock.height

  console.log(`height: ${latestHeight}, sync gap: ${syncGap}`)

  if (syncGap > BLOCK_SYNC_RESTART_THRESHOLD && (await collectorHalted())) {
    const now = Date.now()
    restartCollector(now)
    await Bluebird.delay(10000)
  }

  return syncGap <= BLOCK_SYNC_ALERT_THRESHOLD
}

async function getLatestBlockFromDb(): Promise<BlockEntity | undefined> {
  const where: FindConditions<BlockEntity> = {
    chainId: CHAIN_ID
  }
  const latestBlock = await getRepository(BlockEntity).findOne({
    where,
    order: {
      height: 'DESC'
    }
  })
  return latestBlock
}

async function collectorHalted(): Promise<boolean> {
  const sleepTimeToWait = 30000
  const blockFirst = await getLatestBlockFromDb()
  await Bluebird.delay(sleepTimeToWait)
  const blockAfterThirtySec = await getLatestBlockFromDb()
  if (!blockFirst || !blockAfterThirtySec) {
    return true
  }
  return blockFirst.height === blockAfterThirtySec.height
}

export default async (): Promise<void> => {
  console.log('call collector sync')
  const where: FindConditions<BlockEntity> = {
    chainId: CHAIN_ID
  }

  const savedBlocks = await getRepository(BlockEntity).find({
    where,
    order: {
      height: 'DESC'
    },
    take: 3
  })
  if (!savedBlocks || savedBlocks.length < 3) {
    return
  }

  const blockCorrectlySynced = await isBlockCorrectlySynced(savedBlocks[0])

  if (!blockCorrectlySynced && !incidentId['block']) {
    await alert('block', `A block sync problem has occurred.`)
  }

  if (blockCorrectlySynced && incidentId['block']) {
    await resolve('block')
  }
}
