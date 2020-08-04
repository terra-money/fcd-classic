import * as yargs from 'yargs'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { convertSwaggerForApiGateway } from 'apidoc-swagger'
import * as path from 'path'

import { getFcdSwaggerObject } from './mergeSwaggerFile'

const argv = yargs
  .options({
    o: {
      type: 'string',
      alias: 'output',
      default: 'swagger.json',
      description: 'Output file name'
    },
    apigateway: {
      type: 'boolean',
      alias: 'apiGateway',
      default: false,
      description: 'should generate for api gateway'
    }
  })
  .argv(
    (function generateSwagger() {
      let swagger = getFcdSwaggerObject()

      const dest = path.join(__dirname, '..', '..', 'static')

      if (argv.apigateway) {
        swagger = convertSwaggerForApiGateway(swagger)
      }
      if (!existsSync(dest)) {
        mkdirSync(dest)
      }

      writeFileSync(path.join(dest, argv.output as string), JSON.stringify(swagger))

      console.log(`Swagger file generated in ${path.join(dest, argv.output as string)}`)
    })()
  )
