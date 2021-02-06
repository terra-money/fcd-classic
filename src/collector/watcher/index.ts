import * as Bluebird from 'bluebird'
import { uniq } from 'lodash'
import * as sentry from '@sentry/node'
import { unmarshalTx } from '@terra-money/amino-js'
import { collectorLogger as logger } from 'lib/logger'
import RPCWatcher, { RpcResponse } from 'lib/RPCWatcher'
import * as lcd from 'lib/lcd'
import config from 'config'
import { proposalCollector, blockCollector } from '../collector'
import { saveValidatorDetail } from '../staking/validatorDetails'

const SOCKET_URL = `${config.RPC_URI}/websocket`
const GOVERNANCE_Q = `tm.event='Tx' AND message.module='governance'`
const NEW_BLOCK_Q = `tm.event='NewBlock'`
const VALIDATOR_REGEX = /terravaloper([a-z0-9]{39})/g

/**
 * For throttling purpose,
 * 1. detectValidators extracts valoper... from stringified tx and add to the validatorUpdateSet
 * 2. collectValidators collects validator for addresses from validatorUpdateSet
 */
const validatorUpdateSet = new Set<string>()

async function detectValidators(data: RpcResponse) {
  const marshalTxs = data.result.data?.value.block?.data.txs as string[]

  if (marshalTxs) {
    try {
      // decode amino transactions
      const txs = marshalTxs.map((tx) => unmarshalTx(Buffer.from(tx, 'base64')))

      // extract validator addresses from string
      const addresses = uniq(
        txs
          .map((tx) => JSON.stringify(tx).match(VALIDATOR_REGEX))
          .flat()
          .filter(Boolean) as string[]
      )

      addresses.forEach((address) => validatorUpdateSet.add(address))
    } catch (err) {
      sentry.captureException(err)
    }
  }
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

  setTimeout(collectValidators, 1000)
}

let govUpdated = true

async function collectProposals() {
  if (!govUpdated) {
    return
  }

  govUpdated = false
  await proposalCollector.run().catch(sentry.captureException)
  setTimeout(collectProposals, 1000)
}

let blockUpdated = true

async function collectBlocks() {
  if (!blockUpdated) {
    return
  }

  blockUpdated = false
  await blockCollector.run().catch(sentry.captureException)
  setTimeout(collectBlocks, 50)
}

export async function rpcEventWatcher() {
  let eventCounter = 0

  const watcher = new RPCWatcher({
    url: SOCKET_URL,
    logger
  })

  watcher.registerSubscriber(GOVERNANCE_Q, (data: RpcResponse) => {
    eventCounter += 1
    govUpdated = true
  })

  watcher.registerSubscriber(NEW_BLOCK_Q, async (data: RpcResponse) => {
    eventCounter += 1
    blockUpdated = true
    await detectValidators(data).catch(sentry.captureException)
  })

  await watcher.start()

  const checkRestart = async () => {
    if (eventCounter === 0) {
      logger.info('watcher: event counter is zero. restarting..')
      await rpcEventWatcher()
      return
    }

    eventCounter = 0
    setTimeout(checkRestart, 30000)
  }

  setTimeout(checkRestart, 30000)
  setTimeout(collectBlocks, 1000)
  setTimeout(collectValidators, 5000)
  setTimeout(collectProposals, 5200)
}
