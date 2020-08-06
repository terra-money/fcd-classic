import { collectorLogger as logger } from 'lib/logger'
import RPCWatcher, { RpcResponse } from 'lib/RPCWatcher'

import config from 'config'
import { collectProposal } from '../gov'
import { collectValidator } from '../staking'

const SOCKET_URL = `${config.RPC_URI}/websocket`
const STAKING_Q = `tm.event='Tx' AND message.module='staking'`
const GOVERNANCE_Q = `tm.event='Tx' AND message.module='governance'`

function triggerCollector(collectorFunction: () => Promise<void>) {
  collectorFunction().catch(logger.error)
}

export async function rpcEventWatcher() {
  const watcher = new RPCWatcher({
    url: SOCKET_URL,
    logger
  })

  watcher.registerSubscriber(GOVERNANCE_Q, (data: RpcResponse) => {
    triggerCollector(collectProposal)
  })

  watcher.registerSubscriber(STAKING_Q, (data: RpcResponse) => {
    triggerCollector(collectValidator)
  })

  await watcher.start()
}
