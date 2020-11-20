import { client, connection, IMessage } from 'websocket'
import { Logger } from 'winston'
import { delay } from 'bluebird'

const RETRY_TIMER_IN_MS = 3000 // 3 seconds

type RPCWatcherConfig = {
  url: string
  maxRetryAttempt?: number
  logger: Logger
}

export type RpcResponse = {
  jsonrpc: string
  id: number | string
  result: {
    query?: string
    data?: any
  }
}

type Callback = (response: RpcResponse) => void
type SubscriptionEntity = { query: string; callback: Callback }

export default class RPCWatcher {
  private client = new client()
  private connection: connection
  private subscribers: SubscriptionEntity[] = []

  private connected: boolean = false

  private logger: Logger

  private url: string
  private maxRetryAttempt: number
  private retryCount: number = 0

  constructor(config: RPCWatcherConfig) {
    this.url = config.url
    this.maxRetryAttempt = config.maxRetryAttempt || 0
    this.logger = config.logger
  }

  private parseResponseIdToNumber(data: RpcResponse): number {
    const id = parseInt(data.id.toString(), 10) // return NaN for invalid string
    if (id === NaN) {
      return this.subscribers.length
    }
    return id
  }

  /**
   * Retry to connect to the socket
   */
  private retryConnect() {
    if (!this.maxRetryAttempt || this.retryCount < this.maxRetryAttempt) {
      const retryDelay = RETRY_TIMER_IN_MS * (this.retryCount + 1)
      this.logger.info(`Retrying connection after ${retryDelay / 1000} seconds`)

      delay(retryDelay).then(() => {
        this.logger.info(`Reconnect attempt: ${this.retryCount + 1}`)
        this.client.connect(this.url)
        this.retryCount = this.retryCount + 1
      })
    } else {
      this.logger.error('maximum retry attempt exceed!')
    }
  }

  /**
   * Process response message
   * @param data Response data from socket
   */
  private messageEventProcessor(data: IMessage) {
    if (!data.utf8Data) {
      this.logger.error('No data received response message')
      return
    }
    try {
      const resp: RpcResponse = JSON.parse(data.utf8Data)
      // parsing needed for earlier version of tendermint v0.33
      // it returns string formatted response id ID#event
      resp.id = this.parseResponseIdToNumber(resp)
      if (resp.id < this.subscribers.length) {
        this.subscribers[resp.id].callback(resp)
      } else {
        this.logger.error('Invalid response id')
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
  private errorEventProcessor(error: Error) {
    this.logger.error('Failure in watcher, closing the connection')

    if (!this.close()) {
      this.closeEventProcessor()
    }
  }

  /**
   * Handle socket closing event
   */
  private closeEventProcessor() {
    this.logger.info('Socket closed.')
    this.connected = false

    if (this.maxRetryAttempt) {
      this.retryConnect()
    }
  }

  /**
   * Add listener to connection
   */
  private addListeners() {
    this.connection.on('message', this.messageEventProcessor.bind(this))
    this.connection.on('error', this.errorEventProcessor.bind(this))
    this.connection.on('close', this.closeEventProcessor.bind(this))
  }

  /**
   * Subscribe query
   */
  private addSubscription() {
    this.subscribers.forEach((data: SubscriptionEntity, index: number) => {
      this.connection.send(
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
   * Initialize the connection
   */
  private initConnection() {
    this.client.on('connect', (newConnection) => {
      this.connected = true
      this.retryCount = 0
      this.connection = newConnection
      this.addListeners()
      this.addSubscription()
    })
    this.client.on('connectFailed', this.errorEventProcessor.bind(this))
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
   * start listening to socket for data
   */
  async start() {
    this.logger.info('Starting watcher')
    this.initConnection()
    this.client.connect(this.url)
  }

  restart() {
    this.connection && this.connection.close()
  }

  /**
   * Close connection
   */
  close(): boolean {
    this.maxRetryAttempt = 0

    if (this.connected) {
      this.connection.close()
      this.connected = false
      return true
    }

    return false
  }
}
