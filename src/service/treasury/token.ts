import * as rp from 'request-promise'
import { getContractStore } from 'lib/lcd'
import { div } from 'lib/math'
import config from 'config'

const ASSETS_BY_SYMBOL: {
  [symbol: string]: {
    symbol: string
    name: string
    token: string
    pair: string
    lpToken: string
    status: string
  }
} = {}

export const TOKEN_SYMBOLS: string[] = []

export async function init() {
  const res = await rp(`https://whitelist.mirror.finance/${config.CHAIN_ID.split('-')[0]}.json`, {
    json: true
  }).catch(() => ({}))

  if (TOKEN_SYMBOLS.length && !res.whitelist) {
    // Skip initializing with empty result if there's one exists
    return
  }

  const whitelist = res.whitelist || {}

  Object.keys(whitelist).forEach((address) => {
    const key = whitelist[address].symbol.toLowerCase()
    ASSETS_BY_SYMBOL[key] = whitelist[address]
    TOKEN_SYMBOLS.push(key)
  })
}

export function isToken(symbol: string) {
  return TOKEN_SYMBOLS.includes(symbol.toLowerCase())
}

async function getMirSupply(): Promise<{ totalSupply: string; circulatingSupply: string }> {
  const res = await rp(config.MIRROR_GRAPH_URI, {
    method: 'POST',
    rejectUnauthorized: false,
    body: {
      operationName: 'statistic',
      query: `query statistic {
          statistic {
            mirTotalSupply
            mirCirculatingSupply
          }
        }`,
      variables: {}
    },
    json: true
  })

  if (!res?.data?.statistic) {
    return {
      totalSupply: '',
      circulatingSupply: ''
    }
  }

  return {
    totalSupply: div(res.data.statistic.mirTotalSupply, 1000000),
    circulatingSupply: div(res.data.statistic.mirCirculatingSupply, 1000000)
  }
}

export async function getCirculatingSupply(symbol: string): Promise<string> {
  if (symbol.toLowerCase() === 'mir') {
    return (await getMirSupply()).circulatingSupply
  }

  return getTotalSupply(symbol)
}

export async function getTotalSupply(symbol: string): Promise<string> {
  const lowerCasedSymbol = symbol.toLowerCase()

  if (lowerCasedSymbol === 'mir') {
    return (await getMirSupply()).totalSupply
  }

  const asset = ASSETS_BY_SYMBOL[lowerCasedSymbol]

  if (!asset) {
    return ''
  }

  const res = await getContractStore(asset.token, { token_info: {} })

  if (!res || res.symbol !== asset.symbol || typeof res.total_supply !== 'string') {
    return ''
  }

  return div(res.total_supply, 1000000)
}

export async function getRichList(
  symbol: string,
  page: number,
  limit: number
): Promise<{ account: string; amount: string }[]> {
  if (!(symbol in ASSETS_BY_SYMBOL)) {
    throw new Error('symbol not found')
  }

  const res = await rp(config.MIRROR_GRAPH_URI, {
    method: 'POST',
    rejectUnauthorized: false,
    body: {
      operationName: null,
      query: `query {
        richlist(
          token: "${ASSETS_BY_SYMBOL[symbol].token}",
          offset: ${(page - 1) * limit},
          limit: ${limit}
        ) {
          address
          balance
        }
      }`,
      variables: {}
    },
    json: true
  })

  if (!res?.data?.richlist) {
    return []
  }

  return res.data.richlist.map((e) => ({
    account: e.address,
    amount: div(e.balance, 1000000)
  }))
}
