import * as Bluebird from 'bluebird'
import BigNumber from 'bignumber.js'
import * as rp from 'request-promise'
import * as lcd from 'lib/lcd'
import config from 'config'
import memoizeCache from 'lib/memoizeCache'
import { getTotalSupply } from './token'

interface PylonOverview {
  tokenAddress: string
  priceInUst: number
  totalStaked: string
  circulatingSupply: string
}

async function _getOverview(): Promise<PylonOverview | undefined> {
  const res = await rp(`${config.PYLON_API_ENDPOINT}/mine/v1/overview`, {
    method: 'GET',
    json: true
  })

  if (!res?.data?.tokenAddress) {
    return undefined
  }
  if (typeof res.data.tokenAddress !== 'string') {
    return undefined
  }

  return {
    tokenAddress: res.data.tokenAddress || '',
    priceInUst: res.data.priceInUst || 0.0,
    totalStaked: res.data.totalStaked ? res.data.totalStaked.toString() : '',
    circulatingSupply: res.data.circulatingSupply ? res.data.circulatingSupply.toString() : ''
  } as PylonOverview
}

export const getOverview = memoizeCache(_getOverview, {
  promise: true,
  maxAge: 5 * 60 * 1000 /* 5 minutes */
})

export async function getBalance(address: string): Promise<string> {
  const overview = await getOverview()
  if (!overview || overview.tokenAddress === '') {
    return ''
  }
  const res = await lcd.getContractStore(overview.tokenAddress, { balance: { address } })

  if (!res || typeof res.balance !== 'string') {
    return ''
  }

  return res.balance as string
}
