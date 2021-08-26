import * as Bluebird from 'bluebird'
import { uniq } from 'lodash'
import * as sentry from '@sentry/node'
import { unmarshalTx, Tx } from '@terra-money/amino-js'
import { collectorLogger as logger } from 'lib/logger'
import RPCWatcher, { RpcResponse } from 'lib/RPCWatcher'
import * as lcd from 'lib/lcd'
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
      .filter((tx: any) =>
        (tx?.value?.msg ?? []).some((msg) => typeof msg.type === 'string' && !msg.type.includes('oracle/'))
      )
      .map((tx) => JSON.stringify(tx).match(VALIDATOR_REGEX))
      .flat()
      .filter(Boolean) as string[]
  )

  addresses.forEach((address) => validatorUpdateSet.add(address))
}

async function collectValidators() {
  const addrs = Array.from(validatorUpdateSet.values())
  validatorUpdateSet.clear()

  const votingPower = await lcd.getVotingPower()
  const activePrices = await lcd.getActiveOraclePrices()

  await Bluebird.mapSeries(addrs, (addr) =>
    lcd
      .getValidator(addr)
      .then((lcdValidator) => lcdValidator && saveValidatorDetail({ lcdValidator, activePrices, votingPower }))
  )

  setTimeout(collectValidators, 5000)
}

async function processNewBlock(data: RpcResponse) {
  const marshalTxs = data.result.data?.value.block?.data.txs as string[]
  const height = data.result.data?.value.block?.header.height as string

  if (marshalTxs) {
    try {
      // decode amino transactions
      const txs = marshalTxs.map((tx) => unmarshalTx(Buffer.from(tx, 'base64')))

      detectValidators(txs)
    } catch (err) {
      sentry.captureException(err)
    }
  }
}

let blockUpdated = true

async function collectBlocks() {
  if (!blockUpdated) {
    setTimeout(collectBlocks, 50)
    return
  }

  blockUpdated = false
  await collectBlock().catch(sentry.captureException)
  setTimeout(collectBlocks, 50)
}

export async function startWatcher() {
  let eventCounter = 0
  const watcher = new RPCWatcher({
    url: SOCKET_URL,
    logger,
    maxRetryAttempt: Number.MAX_SAFE_INTEGER
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
