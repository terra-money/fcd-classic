import * as path from 'path'
import * as Koa from 'koa'
import * as bodyParser from 'koa-body'
import * as Router from 'koa-router'
import * as morgan from 'koa-morgan'
import * as cors from '@koa/cors'
import * as helmet from 'koa-helmet'
import * as serve from 'koa-static'
import * as mount from 'koa-mount'
import * as addTrailingSlashes from 'koa-add-trailing-slashes'
import config from 'config'
import { errorHandler, APIError, ErrorTypes } from 'lib/error'
import { error } from 'lib/response'
import proxy from 'lib/bypass'
import controllers from 'controller'
import { configureRoutes } from 'koa-joi-controllers'

const CORS_REGEXP = /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){0,3}terra\.(?:money|dev)(?::\d{4,5})?(?:\/|$)/
const API_VERSION_PREFIX = '/v1'

export default async (): Promise<Koa> => {
  const doc = new Koa()

  doc.use(addTrailingSlashes()).use(
    serve(path.resolve(__dirname, '..', 'apidoc'), {
      maxage: 86400 * 1000
    })
  )

  const app = new Koa()

  app.proxy = true

  app
    .use(morgan('common'))
    .use(helmet())
    .use(mount('/apidoc', doc))
    .use(errorHandler(error))
    .use(async (ctx, next) => {
      await next()

      ctx.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      ctx.set('Pragma', 'no-cache')
      ctx.set('Expires', '0')
    })
    .use(
      cors({
        origin: (ctx) => {
          const requestOrigin = ctx.get('Origin')

          if (process.env.NODE_ENV !== 'production') {
            return requestOrigin
          }

          return CORS_REGEXP.test(requestOrigin) ? requestOrigin : ''
        },
        credentials: true
      })
    )
    .use(
      bodyParser({
        multipart: true,
        onError: (error) => {
          throw new APIError(ErrorTypes.INVALID_REQUEST_ERROR, '', error.message, error)
        }
      })
    )

  const router = new Router()

  router.get('/health', async (ctx) => {
    ctx.status = 200
    ctx.body = 'OK'
  })

  // add API

  configureRoutes(app, controllers, API_VERSION_PREFIX)

  // routes && init
  router.all(
    '(.*)',
    proxy({
      host: config.BYPASS_URI,
      changeOrigin: true,
      requestOptions: {
        strictSSL: false,
        timeout: 20000
      }
    })
  )

  app.use(router.routes())
  app.use(router.allowedMethods())

  return app
}
