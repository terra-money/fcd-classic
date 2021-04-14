import * as http from 'http'
import * as Bluebird from 'bluebird'
import * as sentry from '@sentry/node'

import { init as initORM } from 'orm'
import config from 'config'
import createApp from 'createApp'
import { apiLogger as logger } from 'lib/logger'
import { initializeSentry } from 'lib/errorReporting'
import * as token from 'service/treasury/token'

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
  await token.init()

  const app = await createApp(config.DISABLE_API)
  const server = http.createServer(app.callback())

  server.listen(config.PORT, () => {
    logger.info(`${packageJson.description} is listening on port ${config.PORT}`)
  })

  return server
}

if (require.main === module) {
  createServer().catch((err) => {
    logger.error(err)
  })
}
