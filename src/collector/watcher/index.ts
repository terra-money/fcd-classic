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
 * Extract valoper... from stringified tx and collector validators
 */
async function collectorValidators(data: RpcResponse) {
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

      const votingPower = await lcd.getVotingPower()
      const activePrices = await lcd.getActiveOraclePrices()

      await Bluebird.map(addresses, (addr) =>
        lcd
          .getValidator(addr)
          .then((lcdValidator) => lcdValidator && saveValidatorDetail({ lcdValidator, activePrices, votingPower }))
      )
    } catch (err) {
      sentry.captureException(err)
    }
  }
}

export async function rpcEventWatcher() {
  let eventCounter = 0

  const watcher = new RPCWatcher({
    url: SOCKET_URL,
    logger
  })

  watcher.registerSubscriber(GOVERNANCE_Q, (data: RpcResponse) => {
    eventCounter += 1
    proposalCollector.run().catch(sentry.captureException)
  })

  watcher.registerSubscriber(NEW_BLOCK_Q, async (data: RpcResponse) => {
    eventCounter += 1

    await Promise.all([blockCollector.run(), collectorValidators(data)]).catch(sentry.captureException)
  })

  await watcher.start()

  const checkRestart = async () => {
    if (eventCounter === 0) {
      logger.info('watcher: event counter is zero. restarting..')
      await rpcEventWatcher()
      return
    }

    eventCounter = 0
    setTimeout(checkRestart, 60000)
  }

  setTimeout(checkRestart, 60000)
}
