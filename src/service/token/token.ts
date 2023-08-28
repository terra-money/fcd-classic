import { request } from 'undici'
import { getContractStore } from 'lib/lcd'
import { div } from 'lib/math'
import config from 'config'
import * as anchor from './anchor'
import * as pairsRes from './pairs.dex'

interface Asset {
  symbol: string
  name: string
  token: string
  pair: string
  lpToken: string
  status: string
}

const ASSETS_BY_TOKEN: {
  [token: string]: Asset
} = {}

const ASSETS_BY_PAIR: {
  [pair: string]: Asset
} = {}

const ASSETS_BY_SYMBOL: {
  [symbol: string]: Asset
} = {}

export const TOKEN_SYMBOLS: string[] = []

export async function init() {
  const tokensRes = await request(`https://assets.terraclassic.community/cw20/tokens.json`)
    .then((res) => res.body.json())
    .catch(() => ({}))

  if (!config.TOKEN_NETWORK) {
    console.warn('TOKEN_NETWORK not defined in environment variable')
    return
  }

  const network = config.TOKEN_NETWORK
  const tokens = tokensRes[network]
  const pairs = pairsRes[network]
  const whitelist: { [address: string]: Asset } = {}

  Object.keys(tokens).forEach((address) => {
    const asset = { ...tokens[address] }

    Object.keys(pairs).forEach((pairAddr) => {
      if (pairs[pairAddr][1] === address) {
        asset.pair = pairAddr
      }
    })

    whitelist[address] = asset
  })

  Object.keys(whitelist).forEach((address) => {
    ASSETS_BY_TOKEN[address] = whitelist[address]
    ASSETS_BY_PAIR[whitelist[address].pair] = whitelist[address]

    const key = whitelist[address].symbol.toLowerCase()
    ASSETS_BY_SYMBOL[key] = whitelist[address]
    TOKEN_SYMBOLS.push(key)
  })
}

export function findAssetByPair(address: string): Asset | undefined {
  return ASSETS_BY_PAIR[address]
}

export function findAssetByToken(address: string): Asset | undefined {
  return ASSETS_BY_TOKEN[address]
}

export function getToken(symbol: string) {
  return ASSETS_BY_SYMBOL[symbol.toLowerCase()]
}

export function isToken(symbol: string) {
  return TOKEN_SYMBOLS.includes(symbol.toLowerCase())
}

export async function getCirculatingSupply(symbol: string): Promise<string> {
  if (symbol.toLowerCase() === 'anc') {
    return anchor.getCirculatingSupply()
  }

  return getTotalSupply(symbol)
}

export async function getTotalSupply(symbol: string): Promise<string> {
  const lowerCasedSymbol = symbol.toLowerCase()

  const asset = ASSETS_BY_SYMBOL[lowerCasedSymbol]

  if (!asset) {
    return ''
  }

  const res = await getContractStore(asset.token, { token_info: {} })

  if (!res || typeof res.total_supply !== 'string') {
    return ''
  }

  return div(res.total_supply, 1000000)
}
