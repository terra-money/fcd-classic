import * as rp from 'request-promise'

import { getMergedSwagger, Param, Swagger } from './mergeSwaggerFile'
import config from 'config'

const staticParams = {
  height: 100000,
  hash: 'CAAB4EA3B8BF56B8F160E10C6F4406B20EDE62732762BCDCA0AEE214F9B9FBCB',
  address: 'terra1tqmhs8a86p6w5elffgcl55n4pasrfjmww6fahv',
  delegatorAddr: 'terra1fdw993ph3yxej2xycarl5h9sse4mz24vrjsq4c',
  validatorAddr: 'terravaloper1pdx498r0hrc2fj36sjhs8vuhrz9hd2cw0yhqtk',
  validatorPubKey: 'terravalconspub1zcjduepq9m3l0mafxtvkunllxlscwc35ejpzlgelrne737xncxk0458t5ymqmmhvfv',
  page: 1,
  limit: 10,
  proposalId: 2,
  depositor: 'terra1pdx498r0hrc2fj36sjhs8vuhrz9hd2cw0tmam9',
  voter: 'terra1pdx498r0hrc2fj36sjhs8vuhrz9hd2cw0tmam9',
  denomination: 'uluna',
  offer_coin: '1000000uluna',
  ask_denom: 'usdr',
  denom: 'ukrw',
  validator: 'terravaloper1pdx498r0hrc2fj36sjhs8vuhrz9hd2cw0yhqtk',
  account: 'terra1tqmhs8a86p6w5elffgcl55n4pasrfjmww6fahv',
  interval: '15m',
  base: 'ukrw',
  operatorAddr: 'terravaloper1pdx498r0hrc2fj36sjhs8vuhrz9hd2cw0yhqtk',
  txhash: 'CAAB4EA3B8BF56B8F160E10C6F4406B20EDE62732762BCDCA0AEE214F9B9FBCB'
}

function relacePathParam(url: string, param: Param): string {
  return url.replace(`{${param.name}}`, `${staticParams[param.name]}`)
}

function replaceQueryParam(url: string, param: Param): string {
  if (url.indexOf('?') === -1) {
    return `${url}?${param.name}=${staticParams[param.name]}`
  }
  return `${url}&${param.name}=${staticParams[param.name]}`
}

function replaceUrlParamsAndQuery(url: string, params: Param[]): string {
  let generated = url
  for (const param of params) {
    if (param.required) {
      generated = param.in === 'path' ? relacePathParam(generated, param) : replaceQueryParam(generated, param)
    }
  }

  return generated
}

async function generateUrlsFromSwagger(): Promise<string[]> {
  const swagger: Swagger = await getMergedSwagger()
  const urls: string[] = []
  for (const path in swagger.paths) {
    for (const method in swagger.paths[path]) {
      if (method !== 'get') continue
      let url = `${config.FCD_URI}${path}`
      if (swagger.paths[path][method].parameters) {
        url = replaceUrlParamsAndQuery(url, swagger.paths[path][method].parameters)
      }
      urls.push(url)
    }
  }
  return urls
}

async function isAlive(url): Promise<boolean> {
  return rp(url)
    .then(() => true)
    .catch((err) => {
      const parsedError = JSON.parse(err.error)
      if (parsedError.error && JSON.parse(parsedError.error).code === 102) {
        return true
      }
      return false
    })
}
function hotFix(urls: string[]): string[] {
  // these are the hotfix, will be removed after applying the fixes
  // need to fix lcd swagger
  const index = urls.indexOf(`${config.FCD_URI}${'/distribution/params'}`)
  if (index !== -1) urls[index] = `${config.FCD_URI}${'/distribution/parameters'}`

  // cosmos sdk bug for /gov/proposals/{proposalId}/votes/{account}
  // can test this url after the fix in cosmos

  const filteredUrl = urls.filter(
    (url) => url !== `https://soju-fcd.terra.dev/gov/proposals/2/votes/terra1pdx498r0hrc2fj36sjhs8vuhrz9hd2cw0tmam9`
  )
  return filteredUrl
}
export async function testUrls() {
  const urls = hotFix(await generateUrlsFromSwagger())

  const resp = await Promise.all(urls.map((url) => isAlive(url)))

  const failedUrls = urls.filter((_, index) => !resp[index])
  if (failedUrls.length) {
    console.log(`Failed URL's`, failedUrls)
    throw new Error(failedUrls.join(`\n`))
  } else {
    console.log('All API is live :)')
  }
}

testUrls().catch(() => {
  process.exit(1)
})
