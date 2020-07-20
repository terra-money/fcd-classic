import { client, connection, IMessage } from 'websocket'
import { Logger } from 'winston'
import { delay } from 'bluebird'

const RETRY_TIMER_IN_MS = 5000 // 5 sec

type WatcherConfig = {
  url: string
  retryAttempt: number
  logger: Logger
}

export type RpcResponse = {
  jsonrpc: string
  id: number
  result: {
    query?: string
    data?: any
  }
}

type Callback = (response: RpcResponse) => void
type SubscriptionEntity = { query: string; callback: Callback }

export class NodeWatcher {
  client = new client()
  connection: connection
  subscribers: SubscriptionEntity[] = []

  connected: boolean = false

  logger: Logger

  url: string
  retryAttempt: number
  retryCount: number = 0

  constructor(config: WatcherConfig) {
    this.url = config.url
    this.retryAttempt = config.retryAttempt
    this.logger = config.logger
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
   * Retry to connect to the socket
   */
  private retryConnect() {
    if (this.retryCount < this.retryAttempt) {
      const retryDelay = RETRY_TIMER_IN_MS * (this.retryCount + 1)
      this.logger.info(`Retrying connection after ${retryDelay / 1000} seconds`)
      delay(retryDelay).then(() => {
        this.logger.info(`Reconnect attempt: ${this.retryCount + 1}`)
        this.client.connect(this.url)
        this.retryCount = this.retryCount + 1
      })
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
    if (this.connected) {
      this.connection.close()
      this.connected = false
    } else {
      this.closeEventProcessor()
    }
  }
  /**
   * Handle socket closing event
   */
  private closeEventProcessor() {
    this.logger.info('Socket closed.')
    this.connected = false
    if (this.retryAttempt) {
      this.logger.info('Attempting reconnect....')
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
   * start listening to socket for data
   */
  async watch(detach: boolean = false) {
    this.logger.info('Starting watcher')
    this.initConnection()
    this.client.connect(this.url)

    if (detach) {
      return
    }

    while (this.connected || this.retryCount < this.retryAttempt) {
      await delay(RETRY_TIMER_IN_MS)
    }
  }
  /**
   * Close connection
   */
  close() {
    this.retryAttempt = 0
    if (this.connected) {
      this.connection.close()
    }
  }
}
