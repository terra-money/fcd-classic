import * as http from 'http'
import * as Bluebird from 'bluebird'
import * as sentry from '@sentry/node'
import * as yargs from 'yargs'

import { init as initORM } from 'orm'
import config from 'config'
import createApp from 'createApp'
import { apiLogger as logger } from 'lib/logger'
import { initializeSentry } from 'lib/errorReporting'
import { initSocket } from 'socket'
import reporter from 'reporter'

const packageJson = require('../package.json')

const options = yargs.options({
  all: {
    type: 'boolean',
    alias: 'all',
    default: false,
    description: 'Start REST and socket both.'
  },
  restOnly: {
    type: 'boolean',
    alias: 'rest-only',
    default: false,
    description: 'Start only REST server'
  },
  socketOnly: {
    type: 'boolean',
    alias: 'socket-only',
    default: false,
    description: 'Start only socket server'
  }
}).argv

Bluebird.config({
  longStackTraces: true
})

global.Promise = Bluebird as any

process.on('unhandledRejection', (err) => {
  sentry.captureException(err)
  throw err
})

export async function createServer() {
  // no argument means all true
  if (!options.restOnly && !options.socketOnly) {
    options.all = true
  }

  initializeSentry()

  await initORM()
  const server = http.createServer()
  let socket

  if (options.all || options.restOnly) {
    const app = await createApp()
    server.addListener('request', app.callback())
  }

  if (options.all || options.socketOnly) {
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
