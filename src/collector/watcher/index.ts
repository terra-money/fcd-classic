import * as Bluebird from 'bluebird'
import { uniq, flatten, compact } from 'lodash'
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
      const txs = marshalTxs.map((tx) => unmarshalTx(Buffer.from(tx, 'base64')))
      const addresses = compact(uniq(flatten(txs.map((tx) => JSON.stringify(tx).match(VALIDATOR_REGEX)))))

      const votingPower = await lcd.getVotingPower()
      const activePrices = await lcd.getActiveOraclePrices()

      await Bluebird.map(addresses, async (addr) => {
        const lcdValidator = await lcd.getValidator(addr)
        console.log(lcdValidator)
        return lcdValidator && saveValidatorDetail({ lcdValidator, activePrices, votingPower })
      })
    } catch (err) {
      sentry.captureException(err)
    }
  }
}

export async function rpcEventWatcher() {
  const watcher = new RPCWatcher({
    url: SOCKET_URL,
    logger
  })

  watcher.registerSubscriber(GOVERNANCE_Q, (data: RpcResponse) => {
    proposalCollector.run().catch(sentry.captureException)
  })

  watcher.registerSubscriber(NEW_BLOCK_Q, async (data: RpcResponse) => {
    Promise.all([blockCollector.run(), collectorValidators(data)]).catch(sentry.captureException)
  })

  await watcher.start()
}
