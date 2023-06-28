import { request } from 'undici'
import * as yaml from 'js-yaml'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { createApidocSwagger, convertSwaggerForApiGateway } from 'apidoc-swagger'
import * as path from 'path'
import * as yargs from 'yargs'

import config from 'config'

const LCD_SWAGGER_URL = `${config.LCD_URI}/swagger/swagger.yaml`

interface Info {
  title: string
  version: string
  description: string
}

interface Definition {
  [definitionName: string]: Object
}

export interface Param {
  name: string
  in: string
  required: boolean
}

interface Method {
  description: string
  summary: string
  tags: string[]
  parameters: Param[]
  comsumes?: string[]
  produces?: string[]
  responses: Object
}

interface Path {
  [httpMethod: string]: Method
}

export interface Swagger {
  swagger: string
  info: Info
  paths: {
    [pathName: string]: Path | Param[]
  }
  definitions: Definition
  host?: string
  basePath?: string
}

function mergeParams(commonParams: Param[] = [], individualParams: Param[] = []): Param[] {
  return [...commonParams, ...individualParams]
}

function normalizeSwagger(doc: Swagger): Swagger {
  // Some swagger file contains commond params under paths object
  // We are keeping all params under method params key

  for (const path in doc.paths) {
    for (const method in doc.paths[path]) {
      if (method === 'parameters') {
        continue
      }
      const mergedParams = mergeParams(doc.paths[path]['parameters'], doc.paths[path][method].parameters)
      if (mergedParams.length) {
        doc.paths[path][method].parameters = mergedParams
      }
    }
    delete doc.paths[path]['parameters']
  }
  return doc
}

async function getLcdSwaggerObject(): Promise<Swagger> {
  const options = {
    headers: {
      'User-Agent': 'terra-fcd'
    }
  }

  const doc = yaml.load(await request(LCD_SWAGGER_URL, options).then((res) => res.body.text()))
  return filterExcludedRoutes(normalizeSwagger(doc))
}

export function getFcdSwaggerObject(): Swagger {
  const options = {
    simulate: true,
    src: path.join(__dirname, '..', 'controller'),
    basePath: '/v1',
    silent: true
  }
  const api = createApidocSwagger(options)
  if (api['swaggerData']) {
    return filterExcludedRoutes(normalizeSwagger(JSON.parse(api['swaggerData'])))
  }
  throw new Error('Could not generate fcd swagger')
}

function resolveBasePath(swagger: Swagger): Swagger {
  const { paths } = swagger
  let resoledPath
  if (swagger['basePath']) {
    resoledPath = Object.keys(paths).reduce((acc, path) => {
      acc[`${swagger['basePath']}${path}`] = paths[path]
      return acc
    }, {})
  } else {
    resoledPath = paths
  }
  delete swagger.basePath
  return Object.assign({}, swagger, { paths: resoledPath })
}

export function isRouteExcluded(url: string): boolean {
  for (const exclusionRegEx of config.EXCLUDED_ROUTES) {
    if (exclusionRegEx.test(url)) {
      return true
    }
  }
  return false
}

export function filterExcludedRoutes(swagger: Swagger): Swagger {
  for (const path of Object.keys(swagger.paths)) {
    if (isRouteExcluded(path)) {
      delete swagger.paths[path]
    }
  }
  return swagger
}

export async function getMergedSwagger() {
  const lcd = resolveBasePath(await getLcdSwaggerObject())
  const fcd = resolveBasePath(getFcdSwaggerObject())

  const combinedSwagger: Swagger = {
    swagger: '2.0',
    info: {
      title: 'Terra REST apis',
      version: '1.0.0',
      description: 'Terra LCD and FCD docs'
    },
    paths: {},
    definitions: {}
  }

  combinedSwagger.paths = Object.assign({}, lcd.paths, fcd.paths)
  combinedSwagger.definitions = Object.assign({}, lcd.definitions, fcd.definitions)
  return combinedSwagger
}

async function mergeSwagger() {
  const argv = await yargs.options({
    o: {
      type: 'string',
      alias: 'output',
      default: 'combined-swagger.json',
      description: 'Output file name'
    },
    apigateway: {
      type: 'boolean',
      alias: 'apiGateway',
      default: false,
      description: 'should generate for api gateway'
    }
  }).argv

  const dest = path.join(__dirname, '..', '..', 'static')

  let combinedSwagger = await getMergedSwagger()

  if (argv.apigateway) {
    combinedSwagger = convertSwaggerForApiGateway(combinedSwagger)
  }
  if (!existsSync(dest)) {
    mkdirSync(dest)
  }

  writeFileSync(path.join(dest, argv.output as string), JSON.stringify(combinedSwagger))

  console.log(`Combined file saved in ${path.join(dest, argv.output as string)}`)
}

if (require.main?.filename === __filename) {
  mergeSwagger().catch((e) => console.log(e))
}
