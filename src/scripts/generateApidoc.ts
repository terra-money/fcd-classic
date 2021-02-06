import * as apidoc from 'apidoc-core'
import * as path from 'path'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import * as yargs from 'yargs'

import config from 'config'

import { apiLogger as logger } from 'lib/logger'

import { isRouteExcluded } from './mergeSwaggerFile'

const templateDir = './apidoc-template/'
const templateName = 'index.html'

const options = {
  simulate: true,
  src: path.join(__dirname, '..', 'controller'),
  silent: true
}

const packageInfo = {
  name: 'Terra FCD',
  version: '1.0.0',
  description: 'Terra FCD API Docs',
  title: 'Terra FCD API Docs',
  url: `${config.FCD_URI}/v1` || 'https://fcd.terra.dev/v1'
}

const argv = yargs.options({
  o: {
    type: 'string',
    alias: 'output',
    default: 'static',
    description: 'Output file name'
  }
}).argv

type UrlItem = {
  type: string
  url: string
  title: string
  name: string
  group: string
}

type ApiDoc = {
  data: string
  project: string
}

function filterExcludeRoutes(urls: UrlItem[]) {
  return urls.filter((url: UrlItem) => {
    return !isRouteExcluded(url.url)
  })
}

(function generateApiDoc() {
  apidoc.setLogger(logger)
  apidoc.setPackageInfos(packageInfo)

  const parsedDoc: ApiDoc = apidoc.parse(options)

  const dest = path.join(__dirname, '..', '..', argv.o)
  if (!existsSync(dest)) {
    mkdirSync(dest)
  }

  parsedDoc.data = JSON.stringify(filterExcludeRoutes(JSON.parse(parsedDoc.data) as UrlItem[]))

  const template = path.join(__dirname, '..', '..', templateDir, templateName)
  const outputFile = path.join(dest, templateName)
  console.log(template)
  console.log(outputFile)
  writeFileSync(
    outputFile,
    readFileSync(template)
      .toString()
      .replace('__API_DATA__', parsedDoc.data)
      .replace('__API_PROJECT__', parsedDoc.project)
  )
})()
