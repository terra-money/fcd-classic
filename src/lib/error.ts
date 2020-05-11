// import apm from './apm';
import * as sentry from '@sentry/node'
import { apiLogger as logger } from 'lib/logger'

export enum ErrorTypes {
  // 400 Bad Request
  INVALID_REQUEST_ERROR = 'INVALID_REQUEST_ERROR',
  // 401 Unauthorized
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  NO_PERMISSION_ERROR = 'NO_PERMISSION_ERROR',
  // 403 Forbidden
  FORBIDDEN = 'FORBIDDEN',
  // 404
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  VALIDATOR_DOES_NOT_EXISTS = 'VALIDATOR_DOES_NOT_EXISTS',
  // 408
  TIMEOUT = 'TIMEOUT',
  // 429 Too Many Requests
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  // 500 Internal Server Error
  API_ERROR = 'API_ERROR',
  // 503 Service Unavailable
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  LCD_ERROR = 'LCD_ERROR'
}

export enum ErrorCodes {
  // 400 Bad Request
  INVALID_REQUEST_ERROR = 400,
  // 401 Unauthorized
  AUTHENTICATION_ERROR = 401,
  // 403 Forbidden
  FORBIDDEN = 403,
  // 404
  NOT_FOUND_ERROR = 404,
  // 408
  TIMEOUT = 408,
  // 429 Too Many Requests
  RATE_LIMIT_ERROR = 429,
  // 500 Internal Server Error
  API_ERROR = 500,
  // 503 Service Unavailable
  SERVICE_UNAVAILABLE = 503
}

// error message
const errorMessage = {}

export class APIError extends Error {
  public type: string
  public message: string
  public code: string
  public wrappedError?: Error

  constructor(type: ErrorTypes, code = '', message = '', err?: Error) {
    super(message)
    this.name = 'APIError'
    this.type = type || ErrorTypes.API_ERROR
    this.code = code
    this.message = message || errorMessage[code]
    this.wrappedError = err
  }
}

export function errorHandler(callback: (ctx, type: string, code?: string, message?: string) => void) {
  return async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      if (err instanceof APIError) {
        if (err.type === ErrorTypes.LCD_ERROR && err.wrappedError) {
          ctx.statusCode = (err.wrappedError as any).statusCode
          ctx.body = (err.wrappedError as any).body
        }

        if (err.type === ErrorTypes.API_ERROR) {
          logger.error(err)
          const errForThrow = err.wrappedError || err

          sentry.withScope((scope) => {
            scope.addEventProcessor((event) => sentry.Handlers.parseRequest(event, ctx.request))
            sentry.captureException(errForThrow)
          })
        }

        callback(ctx, err.type, err.code, err.message)
      } else if (err.isJoi) {
        callback(ctx, 'INVALID_REQUEST_ERROR', err.statusCode, err.message)
      } else {
        logger.error(err)
        sentry.withScope((scope) => {
          scope.addEventProcessor((event) => sentry.Handlers.parseRequest(event, ctx.request))
          sentry.captureException(err)
        })

        callback(ctx, 'API_ERROR', err.code, err.message)
      }
    }
  }
}
