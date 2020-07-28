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
import { configureRoutes } from 'koa-joi-controllers'

import config from 'config'
import { errorHandler, APIError, ErrorTypes } from 'lib/error'
import { error } from 'lib/response'
import proxy from 'lib/bypass'
import { apiLogger as logger } from 'lib/logger'

import controllers from 'controller'

const koaSwagger = require('koa2-swagger-ui')

const API_VERSION_PREFIX = '/v1'

function getRootApp(): Koa {
  // root app only contains the health check route
  const app = new Koa()
  const router = new Router()

  router.get('/health', async (ctx) => {
    ctx.status = 200
    ctx.body = 'OK'
  })

  app.use(router.routes())
  app.use(router.allowedMethods())
  return app
}

function getApiDocApp(): Koa {
  // static
  const app = new Koa()

  app.use(addTrailingSlashes()).use(
    serve(path.resolve(__dirname, '..', 'static'), {
      maxage: 86400 * 1000
    })
  )
  return app
}

function getSwaggerApp(): Koa {
  // swagger ui
  const app = new Koa()

  app.use(
    koaSwagger({
      routePrefix: '/',
      swaggerOptions: {
        url: '/static/swagger.json'
      }
    })
  )
  return app
}

export default async (disableAPI: boolean = false): Promise<Koa> => {
  const app = getRootApp()

  if (disableAPI) {
    // Return app with only health check if api is disbaled.
    logger.info('API Disabled')
    return app
  }

  logger.info('Adding REST API')
  app.proxy = true
  const apiDocApp = getApiDocApp()
  const swaggerApp = getSwaggerApp()

  app
    .use(morgan('common'))
    .use(helmet())
    .use(mount('/static', apiDocApp))
    .use(mount('/apidoc', apiDocApp))
    .use(mount('/swagger', swaggerApp))
    .use(errorHandler(error))
    .use(async (ctx, next) => {
      await next()

      ctx.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      ctx.set('Pragma', 'no-cache')
      ctx.set('Expires', '0')
    })
    .use(cors())
    .use(
      bodyParser({
        multipart: true,
        onError: (error) => {
          throw new APIError(ErrorTypes.INVALID_REQUEST_ERROR, '', error.message, error)
        }
      })
    )

  // add API
  configureRoutes(app, controllers, API_VERSION_PREFIX)

  // routes && init
  const router = new Router()
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
