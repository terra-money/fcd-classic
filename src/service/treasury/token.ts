import * as rp from 'request-promise'
import { getContractStore } from 'lib/lcd'
import { div } from 'lib/math'
import config from 'config'

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
  const tokensRes = await rp(`https://assets.terra.money/cw20/tokens.json`, {
    json: true
  }).catch(() => ({}))

  const pairsRes = await rp(`https://assets.terra.money/cw20/pairs.json`, {
    json: true
  }).catch(() => ({}))

  let key

  if (config.CHAIN_ID.startsWith('columbus')) {
    key = 'mainnet'
  } else if (config.CHAIN_ID.startsWith('tequila')) {
    key = 'testnet'
  } else {
    console.log('no token info for this chain-id')
    return
  }

  const tokens = tokensRes[key]
  const pairs = pairsRes[key]
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
