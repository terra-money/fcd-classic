import * as lcd from 'lib/lcd'
import { getLastDayPrices } from './helper'
import { minus, div } from 'lib/math'
import { BOND_DENOM } from 'lib/constant'

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

export function getSwapRate(prices: DenomMap, base: string): DenomMap {
  if (base === BOND_DENOM) {
    return prices
  }

  const lunaSwapRate = prices[base] ? div(1, prices[base]) : '0.00000000'

  return Object.keys(prices).reduce(
    (acc, curr) => {
      if (curr === base) {
        return acc
      }

      return { ...acc, [curr]: div(prices[curr], prices[base]) }
    },
    { uluna: lunaSwapRate }
  )
}

export default async function getDenomSwapRate(base: string): Promise<SwapRate[]> {
  const prices = await lcd.getActiveOraclePrices()
  const currentSwapRate = getSwapRate(prices, base)

  const lastDayPrices = await getLastDayPrices()
  const lastDaySwapRate = getSwapRate(lastDayPrices, base)

  return Object.keys(currentSwapRate).map((denom) => {
    const oneDayVariation = lastDaySwapRate[denom] ? minus(currentSwapRate[denom], lastDaySwapRate[denom]) : '0'
    const oneDayVariationRate = lastDaySwapRate[denom]
      ? minus(div(currentSwapRate[denom], lastDaySwapRate[denom]), 1)
      : '0'
    return {
      denom,
      swaprate: currentSwapRate[denom],
      oneDayVariation,
      oneDayVariationRate
    }
  })
}
