import * as rp from 'request-promise'
import config from 'config'
import memoizeCache from 'lib/memoizeCache'

interface PylonOverview {
  tokenAddress: string
  priceInUst: number
  totalStaked: number
  circulatingSupply: number
}

async function _getOverview(): Promise<PylonOverview> {
  const res = await rp(`${config.PYLON_API_ENDPOINT}/mine/v1/overview`, {
    method: 'GET',
    json: true
  })

  const { tokenAddress = '', priceInUst = 0.0, totalStaked = 0, circulatingSupply = 0 } = res

  return {
    tokenAddress,
    priceInUst,
    totalStaked,
    circulatingSupply
  } as PylonOverview
}

export const getOverview = memoizeCache(_getOverview, {
  promise: true,
  maxAge: 5 * 60 * 1000 /* 5 minutes */
})
