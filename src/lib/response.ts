import { Context } from 'koa'
import { ErrorTypes } from './error'

const TYPES_TO_HTTP_STATUS_CODES = {
  [ErrorTypes.INVALID_REQUEST_ERROR]: 400, // Bad Request
  [ErrorTypes.AUTHENTICATION_ERROR]: 401, // Unauthorized
  [ErrorTypes.NO_PERMISSION_ERROR]: 401,
  [ErrorTypes.FORBIDDEN]: 403, // Forbidden
  [ErrorTypes.VALIDATOR_DOES_NOT_EXISTS]: 404,
  [ErrorTypes.NOT_FOUND_ERROR]: 404,
  [ErrorTypes.TIMEOUT]: 408,
  [ErrorTypes.RATE_LIMIT_ERROR]: 429, // Too Many Requests
  [ErrorTypes.API_ERROR]: 500,
  [ErrorTypes.SERVICE_UNAVAILABLE]: 503,
  [ErrorTypes.LCD_ERROR]: 500
}

export function success(ctx: Context, body: any = null, statusCode = 200) {
  ctx.status = statusCode

  if (body === null) {
    ctx.body = JSON.stringify(body)
  } else {
    ctx.body = body
  }
}

export function error(ctx: Context, type: string, code = '', message = ''): void {
  ctx.status = TYPES_TO_HTTP_STATUS_CODES[type] || 500

  const body: { type: string; message: string | undefined; code: string | undefined } = {
    type,
    message: undefined,
    code: undefined
  }

  if (message) {
    body.message = message
  }

  if (code) {
    body.code = code
  }

  ctx.body = body
}
