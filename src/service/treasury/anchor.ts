import * as Bluebird from 'bluebird'
import BigNumber from 'bignumber.js'
import * as lcd from 'lib/lcd'
import config from 'config'
import memoizeCache from 'lib/memoizeCache'
import { getTotalSupply } from './token'

export async function getAnchorBalance(address: string): Promise<string> {
  const res = await lcd.getContractStore(config.ANCHOR_TOKEN_ADDRESS, { balance: { address } })

  if (!res || typeof res.balance !== 'string') {
    return ''
  }

  return res.balance as string
}

export async function getCirculatingSupplyRaw(): Promise<string> {
  const [results, totalSupply] = await Promise.all([
    Bluebird.map(config.ANCHOR_BANK_WALLETS, getAnchorBalance),
    getTotalSupply('anc')
  ])

  const sum = results.reduce((p, c) => p.plus(c), new BigNumber('0')).div(1000000)
  return new BigNumber(totalSupply).minus(sum).toString()
}

export const getCirculatingSupply = memoizeCache(getCirculatingSupplyRaw, {
  promise: true,
  maxAge: 5 * 60 * 1000 /* 5 minutes */
})
