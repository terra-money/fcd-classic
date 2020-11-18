import * as Sentry from '@sentry/node'
import config from 'config'
import { apiLogger as logger } from 'lib/logger'

export function errorReport(error) {
  logger.error(error)

  if (config.SENTRY_DSN && process.env.NODE_ENV === 'production') {
    Sentry.captureException(error)
  }
}

export function initializeSentry() {
  if (config.SENTRY_DSN && process.env.NODE_ENV === 'production') {
    Sentry.init({ dsn: config.SENTRY_DSN, environment: config.CHAIN_ID })
  }
}
