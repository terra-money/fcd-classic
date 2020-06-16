import * as http from 'http'
import * as Bluebird from 'bluebird'
import * as sentry from '@sentry/node'

import { init as initORM } from 'orm'
import config from 'config'
import createApp from 'createApp'
import { apiLogger as logger } from 'lib/logger'
import { initializeSentry } from 'lib/errorReporting'
import { initSocket } from 'socket'
import reporter from 'reporter'

const packageJson = require('../package.json')

Bluebird.config({
  longStackTraces: true
})

global.Promise = Bluebird as any

process.on('unhandledRejection', (err) => {
  sentry.captureException(err)
  throw err
})

export async function createServer() {
  initializeSentry()

  await initORM()
  const server = http.createServer()
  let socket

  if (!config.DISABLE_API) {
    logger.info(`Adding rest API`)
    const app = await createApp()
    server.addListener('request', app.callback())
  }

  if (!config.DISABLE_SOCKET) {
    logger.info(`Adding Socket`)
    socket = initSocket(server)
    await reporter()
  }

  server.listen(config.PORT, () => {
    logger.info(`${packageJson.description} is listening on port ${config.PORT}`)
  })

  return { server, socket }
}

if (require.main === module) {
  createServer().catch((err) => {
    logger.error(err)
  })
}
