import * as Bluebird from 'bluebird'
import { uniq, flatten, compact } from 'lodash'
import * as sentry from '@sentry/node'
import { unmarshalTx } from '@terra-money/amino-js'
import { collectorLogger as logger } from 'lib/logger'
import RPCWatcher, { RpcResponse } from 'lib/RPCWatcher'
import * as lcd from 'lib/lcd'
import config from 'config'
import { proposalCollector } from '../collector'
import { saveValidatorDetail } from '../staking/validatorDetails'

const SOCKET_URL = `${config.RPC_URI}/websocket`
const GOVERNANCE_Q = `tm.event='Tx' AND message.module='governance'`
const NEW_BLOCK_Q = `tm.event='NewBlock'`
const VALIDATOR_REGEX = /terravaloper1([a-z0-9]{38})/g

export async function rpcEventWatcher() {
  const watcher = new RPCWatcher({
    url: SOCKET_URL,
    logger
  })

  watcher.registerSubscriber(GOVERNANCE_Q, (data: RpcResponse) => {
    proposalCollector.run().catch((err) => {
      sentry.captureException(err)
    })
  })

  watcher.registerSubscriber(NEW_BLOCK_Q, async (data: RpcResponse) => {
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
  })

  await watcher.start()
}
