import * as lcd from 'lib/lcd'

import { getOnedayBefore, getSwapRate } from './helper'
import { minus, div } from 'lib/math'

export interface GetPriceParam {
  interval: string
  denom: string
  count: number
}

interface SwapRate {
  denom: string // denom name
  swaprate: string // denom swap rate
  oneDayVariation: string // swap rate change
  oneDayVariationRate: string // swap rate change ratio
}

export default async function getDenomSwapRate(base: string): Promise<SwapRate[]> {
  const prices = await lcd.getActiveOraclePrices()
  const currentSwapRate = getSwapRate(prices, base)

  const denomOneDayBeforePrices = await getOnedayBefore()
  const oneDayBeforeSwapRate = getSwapRate(denomOneDayBeforePrices, base)

  return Object.keys(currentSwapRate).map((denom) => {
    const oneDayVariation = oneDayBeforeSwapRate[denom]
      ? minus(currentSwapRate[denom], oneDayBeforeSwapRate[denom])
      : '0'
    const oneDayVariationRate = oneDayBeforeSwapRate[denom]
      ? minus(div(currentSwapRate[denom], oneDayBeforeSwapRate[denom]), 1)
      : '0'
    return {
      denom,
      swaprate: currentSwapRate[denom],
      oneDayVariation,
      oneDayVariationRate
    }
  })
}
