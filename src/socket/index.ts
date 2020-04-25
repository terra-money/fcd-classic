import Socket from './Socket'
import { apiLogger as logger } from 'lib/logger'
import * as http from 'http'

let socket: Socket

export function initSocket(server: http.Server): Socket {
  if (socket) {
    return socket
  }

  socket = new Socket(server)

  logger.info('Socket: initialized')
  return socket
}

export const getSocket = (): Socket => socket
