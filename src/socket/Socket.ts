import config from 'config'
import * as socketClusterServer from 'socketcluster-server'
import { apiLogger as logger } from 'lib/logger'
import { without } from 'lodash'

export default class Socket {
  public listnerIdsByChannel: { [key: string]: string[] } = {}
  private socketById = {}
  public exchange: {
    publish: (channel: string, data: object, error: (error?: Error) => void) => void
  }

  constructor(server) {
    const scServer = socketClusterServer.attach(server, {
      authKey: config.SC_AUTH_KEY
      // wsEngine: 'sc-uws'
    })

    scServer.on('connection', (socket) => {
      logger.info(`Socket: new connection ${socket.id}`)
      this.socketById[socket.id] = socket

      socket.on('subscribe', (channel) => {
        if (this.listnerIdsByChannel[channel]) {
          this.listnerIdsByChannel[channel] = this.listnerIdsByChannel[channel].concat(socket.id)
        } else {
          this.listnerIdsByChannel[channel] = [socket.id]
        }
      })

      socket.on('unsubscribe', (channel) => {
        if (this.listnerIdsByChannel[channel]) {
          this.listnerIdsByChannel[channel] = without(this.listnerIdsByChannel[channel], socket.id)
          if (this.listnerIdsByChannel[channel].length < 1) {
            delete this.listnerIdsByChannel[channel]
          }
        }
      })
    })

    scServer.on('disconnection', (socket) => {
      delete this.socketById[socket.id]
      logger.info(`Socket: disconnect ${socket.id}`)
    })

    scServer.addMiddleware(scServer.MIDDLEWARE_PUBLISH_IN, (req, next) => {
      logger.info(`Socket: PUBLISH not allowed in channel: ${req.channel}, socket: ${req.socket.id}`)
      next(true)
    })

    this.exchange = scServer.exchange

    scServer.on('subscribe', (data) => logger.info({ message: 'subscribe', data }))
    scServer.on('unsubscribe', (data) => logger.info({ message: 'subscribe', data }))
  }

  public publish(channel, data): void {
    this.exchange.publish(channel, data, (err) => err && logger.error(err))
  }

  public getSubscriptionChannels(): string[] {
    return Object.keys(this.listnerIdsByChannel)
  }

  emit(id, event, data): void {
    const socket = this.socketById[id]
    if (socket) {
      socket.emit(event, data)
    }
  }
}
