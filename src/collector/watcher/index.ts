import * as WebSocket from 'ws'
import { delay } from 'bluebird'

import config from 'config'
import { collectorLogger as logger } from 'lib/logger'

import { collectProposal } from '../gov'
import { collectValidator } from '../staking'

const SOCKET_URL = `${config.RPC_URI}/websocket`
const STAKING_Q_ID = 0
const GOV_Q_ID = 1
const STAKING_MSG = {
  jsonrpc: `2.0`,
  method: `subscribe`,
  id: STAKING_Q_ID,
  params: {
    query: `tm.event='Tx' AND message.module='staking'`
  }
}

const GOVERNANCE_MSG = {
  jsonrpc: `2.0`,
  method: `subscribe`,
  id: GOV_Q_ID,
  params: {
    query: `tm.event='Tx' AND message.module='governance'`
  }
}

type RpcResponse = {
  jsonrpc: string
  id: number
  result: {
    query?: string
    data?: any
  }
}

function triggerCollector(collectorFunction: () => Promise<void>) {
  collectorFunction().catch((error) => {
    logger.error(error)
  })
}

async function watchGovAndStaking() {
  let socketClosed = false
  const socket = new WebSocket(SOCKET_URL)
  socket.on('open', () => {
    socket.send(JSON.stringify(STAKING_MSG))
    socket.send(JSON.stringify(GOVERNANCE_MSG))
  })

  socket.on('message', (responseStr: string) => {
    const data: RpcResponse = JSON.parse(responseStr)
    switch (data.id) {
      case STAKING_Q_ID:
        triggerCollector(collectValidator)
        break
      case GOV_Q_ID:
        triggerCollector(collectProposal)
        break
      default:
        break
    }
  })

  socket.on('close', () => {
    logger.info('Closing the socket')
    socketClosed = true
  })
  socket.on('error', (error) => {
    logger.error(error)
    socket.close()
  })

  while (!socketClosed) {
    logger.info('Socket is alive')
    await delay(6000)
  }
  logger.info('Websocket closed')
}

export async function rpcEventWatcher() {
  await watchGovAndStaking()
}
