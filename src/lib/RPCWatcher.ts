// Doing double import/require because reconnecting-websocket has bad TypeScript definition
import RWS from 'reconnecting-websocket'
import { Logger } from 'winston'
const ReconnectingWebSocket = require('reconnecting-websocket')
import * as WebSocket from 'ws'

type RPCWatcherConfig = {
  url: string
  maxRetries?: number // Maxmimum number of reconnect attempts
  logger: Logger
}

export type RpcResponse = {
  jsonrpc: string
  id: number | string
  result: {
    query?: string
    data?: {
      type: string
      value: any
    }
    events: {
      [name: string]: string[]
    }
  }
}

type Callback = (response: RpcResponse) => void
type SubscriptionEntity = { query: string; callback: Callback }

export default class RPCWatcher {
  private client: RWS
  private subscribers: SubscriptionEntity[] = []
  private connected = false
  private logger: Logger
  private url: string

  constructor(config: RPCWatcherConfig) {
    this.url = config.url
    this.logger = config.logger

    // startClosed true for registering Tendermint subscription
    this.client = new ReconnectingWebSocket(config.url, [], {
      maxRetries: config.maxRetries || Infinity,
      startClosed: true,
      WebSocket: WebSocket
    })

    this.client.onerror = this.onError.bind(this)
    this.client.onopen = this.onOpen.bind(this)
    this.client.onmessage = this.onMessage.bind(this)
    this.client.onclose = this.onClose.bind(this)
  }

  /**
   * Register the subscriber to the watcher
   * @param query
   * @param callback
   */
  registerSubscriber(query: string, callback: Callback) {
    this.subscribers.push({
      query,
      callback
    })
  }

  /**
   * Subscribe query
   */
  private sendSubscriptions() {
    this.subscribers.forEach((data: SubscriptionEntity, index: number) => {
      this.logger.info(`RPCWatcher: registering ${data.query}`)

      this.client.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'subscribe',
          id: index,
          params: {
            query: data.query
          }
        })
      )
    })
  }

  /**
   * start listening to socket for data
   */
  async start() {
    this.logger.info('RPCWatcher: start')
    this.client.reconnect()
  }

  /**
   * force restart
   */
  restart() {
    this.client.reconnect()
  }

  /**
   * close connection
   */
  close(): boolean {
    if (this.connected) {
      this.client.close()
      this.connected = false
      return true
    }

    return false
  }

  /**
   * Called when connection is established
   */
  private onOpen() {
    this.logger.info('RPCWatcher: connection established')
    this.connected = true
    this.sendSubscriptions()
  }

  /**
   * Process response message
   * @param data Response data from socket
   */
  private onMessage(ev: MessageEvent) {
    try {
      const resp: RpcResponse = JSON.parse(ev.data)

      if (typeof resp.jsonrpc === 'undefined' || typeof resp.id === 'undefined') {
        // Skip invalid response
        return
      }

      if (resp.result) {
        const subscriber = this.subscribers.find((s) => s.query === resp.result.query)

        if (subscriber) {
          subscriber.callback(resp)
        }
      }
    } catch (error) {
      this.logger.error('Error in response data parsing')
      this.logger.error(error)
    }
  }

  /**
   * Handle socket error event
   * @param error
   */
  private onError(ev: ErrorEvent) {
    this.logger.error(`RPCWatcher: error: ${ev.message}`)
  }

  /**
   * Handle socket closing event
   */
  private onClose() {
    this.logger.info('RPCWatcher: connection lost')
    this.connected = false
  }
}
