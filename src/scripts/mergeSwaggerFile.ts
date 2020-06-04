import * as rp from 'request-promise'
import * as yaml from 'js-yaml'
import { writeFileSync } from 'fs'
import { createApidocSwagger } from 'apidoc-swagger'
import * as path from 'path'

async function getLcdSwaggerObject() {
  console.log(createApidocSwagger)
  try {
    const doc = yaml.safeLoad(await rp('https://lcd.terra.dev/swagger-ui/swagger.yaml'))
    console.log(doc.info)
    // const json = JSON.stringify(doc)
    // writeFileSync('tmpswg.json', JSON.stringify(doc))
    return doc
  } catch (err) {
    throw err
  }
}

async function getFcdSwaggerObject() {
  console.log(path.join(__dirname, '..', 'controller'))
  const options = {
    simulate: true,
    src: path.join(__dirname, '..', 'controller'),
    basePath: '/v1'
  }
  const api = createApidocSwagger(options)
  if (api['swaggerData']) {
    return api['swaggerData']
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
    })
  } else {
    resoledPath = paths
  }

  return Object.assign({}, swagger, { basePath: undefined, paths: resoledPath })
}

async function mergeFiles() {
  const lcd = resolveBasePath(await getLcdSwaggerObject())
  const fcd = resolveBasePath(await getFcdSwaggerObject())
}

mergeFiles().catch((e) => console.log(e))
