import { exec } from 'child_process'
import * as Bluebird from 'bluebird'
import got from 'got'
import { get } from 'lodash'
import { BlockEntity, TxEntity } from 'orm'
import { getRepository, FindConditions } from 'typeorm'
import config from 'config'
import { COLLECTOR_PM2_ID, CHAIN_ID, BLOCK_SYNC_RESTART_THRESHOLD, BLOCK_SYNC_ALERT_THRESHOLD } from './constants'
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
  if (!restartTimestamp || now - restartTimestamp > 30000) {
    exec(`pm2 restart ${COLLECTOR_PM2_ID}`, (err, stdout) => {
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
  const latestBlock = await got.get(`${config.LCD_URI}/blocks/latest`).json()
  const latestHeight = get(latestBlock, 'block.header.height')
  const syncGap = latestHeight - lastSavedBlock.height

  console.log(`height: ${latestHeight}, sync gap: ${syncGap}`)

  if (syncGap > BLOCK_SYNC_RESTART_THRESHOLD) {
    const now = Date.now()
    restartCollector(now)
    await Bluebird.delay(10000)
  }

  return syncGap <= BLOCK_SYNC_ALERT_THRESHOLD
}

const isTxCorrectlySynced = async (lastSavedBlock: BlockEntity): Promise<boolean> => {
  const blockTxs = await getRepository(TxEntity).find({
    where: {
      block: lastSavedBlock.id
    }
  })

  const blockNumTx = Number(get(lastSavedBlock.data, 'block.header.num_txs'))
  const savedNumTx = blockTxs.length
  console.log(`height: ${lastSavedBlock.height}, # of tx match: ${blockNumTx === savedNumTx}`)

  return blockNumTx === savedNumTx
}

export default async (): Promise<void> => {
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
  const txCorrectlySynced = await isTxCorrectlySynced(savedBlocks[2])

  if (!blockCorrectlySynced && !incidentId['block']) {
    await alert('block', `A block sync problem has occurred.`)
  }

  if (blockCorrectlySynced && incidentId['block']) {
    await resolve('block')
  }

  if (!txCorrectlySynced && !incidentId['tx']) {
    console.error(`A tx sync problem has occurred. (Block height: ${savedBlocks[1].height})`)
  }
}
