import * as rp from 'request-promise'
import * as yaml from 'js-yaml'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { createApidocSwagger } from 'apidoc-swagger'
import * as path from 'path'

import * as yargs from 'yargs'

const argv = yargs.options({
  o: {
    type: 'string',
    alias: 'output',
    default: 'combined-swagger.json',
    description: 'Output file name'
  }
}).argv

async function getLcdSwaggerObject() {
  try {
    const doc = yaml.safeLoad(await rp('https://lcd.terra.dev/swagger-ui/swagger.yaml'))
    // const json = JSON.stringify(doc)
    // writeFileSync('tmpswg.json', JSON.stringify(doc))
    return doc
  } catch (err) {
    throw err
  }
}

async function getFcdSwaggerObject() {
  const options = {
    simulate: true,
    src: path.join(__dirname, '..', 'controller'),
    basePath: '/v1',
    silent: true
  }
  const api = createApidocSwagger(options)
  if (api['swaggerData']) {
    return JSON.parse(api['swaggerData'])
  }
  throw new Error('Could not generate fcd swagger')
}

function resolveBasePath(swagger) {
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

  return Object.assign({}, swagger, { basePath: undefined, paths: resoledPath })
}

async function mergeFiles() {
  const dest = path.join(__dirname, '..', '..', 'static')

  const lcd = resolveBasePath(await getLcdSwaggerObject())
  const fcd = resolveBasePath(await getFcdSwaggerObject())

  const combinedSwagger = {
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
  if (!existsSync(dest)) {
    mkdirSync(dest)
  }
  writeFileSync(path.join(dest, argv.output as string), JSON.stringify(combinedSwagger))

  console.log(`Combined file saved in ${path.join(dest, argv.output as string)}`)
}

mergeFiles().catch((e) => console.log(e))
