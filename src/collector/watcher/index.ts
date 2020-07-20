import config from 'config'

import { collectorLogger as logger } from 'lib/logger'
import { NodeWatcher, RpcResponse } from 'lib/watcher'

import { collectProposal } from '../gov'
import { collectValidator } from '../staking'

const SOCKET_URL = `${config.RPC_URI}/websocket`
const STAKING_Q = `tm.event='Tx' AND message.module='staking'`
const GOVERNANCE_Q = `tm.event='Tx' AND message.module='governance'`
const RETRY_ATTEMPT = 5

function triggerCollector(collectorFunction: () => Promise<void>) {
  collectorFunction().catch((error) => {
    logger.error(error)
  })
}

export async function rpcEventWatcher() {
  const watcher = new NodeWatcher({
    url: SOCKET_URL,
    retryAttempt: RETRY_ATTEMPT,
    logger
  })

  watcher.registerSubscriber(GOVERNANCE_Q, (data: RpcResponse) => {
    triggerCollector(collectProposal)
  })
  watcher.registerSubscriber(STAKING_Q, (data: RpcResponse) => {
    triggerCollector(collectValidator)
  })
  await watcher.watch()
}
