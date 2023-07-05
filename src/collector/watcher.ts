import * as Bluebird from 'bluebird'
import { uniq } from 'lodash'
import * as sentry from '@sentry/node'
import { collectorLogger as logger } from 'lib/logger'
import RPCWatcher, { RpcResponse } from 'lib/RPCWatcher'
import * as lcd from 'lib/lcd'
import { decodeTx } from 'lib/tx'
import { Tx } from '@classic-terra/terra.js'
import config from 'config'
import { saveValidatorDetail } from './staking/validatorDetails'
import { collectBlock } from './block'

const SOCKET_URL = `${config.RPC_URI.replace('http', 'ws')}/websocket`
const NEW_BLOCK_Q = `tm.event='NewBlock'`

/**
 * For throttling purpose,
 * 1. detectValidators extracts valoper... from stringified tx and add to the validatorUpdateSet
 * 2. collectValidators collects validator for addresses from validatorUpdateSet
 */
const validatorUpdateSet = new Set<string>()
const VALIDATOR_REGEX = /terravaloper([a-z0-9]{39})/g

async function detectValidators(txs: Tx[]) {
  // extract validator addresses from string
  const addresses = uniq(
    txs
      .filter(
        (tx) => (tx?.body?.messages ?? []).some((msg) => !msg.toData()['@type'].startsWith('/terra.oracle')) // ignore oracle messages
      )
      .map((tx) => JSON.stringify(tx).match(VALIDATOR_REGEX))
      .flat()
      .filter(Boolean) as string[]
  )

  addresses.forEach((address) => validatorUpdateSet.add(address))
}

async function collectValidators() {
  const extValidators = await lcd.getValidatorsAndConsensus('BOND_STATUS_BONDED')
  const activePrices = await lcd.getActiveOraclePrices()

  const validatorAddressesToUpdate = Array.from(validatorUpdateSet.values())
  validatorUpdateSet.clear()

  await Bluebird.mapSeries(validatorAddressesToUpdate, (addr) => {
    const extVal = extValidators.find((i) => i.lcdValidator.operator_address === addr)

    if (extVal) {
      return saveValidatorDetail(extVal, activePrices).catch(() => null)
    }
  })

  setTimeout(collectValidators, 5000)
}

async function processNewBlock(data: RpcResponse) {
  const marshalTxs = data.result.data?.value.block?.data.txs as string[]
  // const height = data.result.data?.value.block?.header.height as string

  if (marshalTxs) {
    try {
      // decode amino transactions
      const txs = marshalTxs.map(decodeTx)

      detectValidators(txs)
    } catch (err) {
      logger.error(`processNewBlock:`, err)
    }
  }
}

let blockUpdated = true

async function collectBlocks() {
  if (!blockUpdated) {
    setTimeout(collectBlocks, 10)
    return
  }

  await collectBlock()
    .then((done) => (blockUpdated = !done))
    .catch(sentry.captureException)

  setTimeout(collectBlocks, 10)
}

export async function startWatcher() {
  let eventCounter = 0

  const watcher = new RPCWatcher({
    url: SOCKET_URL,
    logger
  })

  watcher.registerSubscriber(NEW_BLOCK_Q, async (resp: RpcResponse) => {
    eventCounter += 1
    blockUpdated = true
    await processNewBlock(resp).catch(sentry.captureException)
  })

  await watcher.start()

  const checkRestart = async () => {
    if (eventCounter === 0) {
      logger.info('watcher: event counter is zero. restarting..')
      watcher.restart()
      return
    }

    eventCounter = 0
    setTimeout(checkRestart, 20000)
  }

  setTimeout(checkRestart, 20000)
}

export async function startPolling() {
  setTimeout(collectBlocks, 0)
  setTimeout(collectValidators, 1000)
}
