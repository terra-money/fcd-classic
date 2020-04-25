import { getRepository, In } from 'typeorm'
import { PriceEntity } from 'orm'

import { getQueryDatetimes, getTargetDatetime, getOnedayBefore } from './helper'
import { minus, div } from 'lib/math'

interface GetPriceParams {
  denom: string // denom name ukrw, uluna, usdr, uusd
  interval: string // price interval 1m,15m,1d: m => minutes, d => day
  count: number // count of data points
}

interface PriceDataByDate {
  denom: string // denom name ukrw, uluna, usdr, uusd
  datetime: number // date time unix
  price: number // price
}

interface GetPriceReturn {
  lastPrice: number | undefined // latest price, undefined if not exists
  oneDayVariation: string | undefined // price changes in one day, undefined if not exists
  oneDayVariationRate: string | undefined // price change ratio in one day, undefined if not exists
  prices: PriceDataByDate[] // list of price points
}

export default async function getPrice(params: GetPriceParams): Promise<GetPriceReturn> {
  const { denom, interval, count } = params
  const queryDatetimes = getQueryDatetimes(interval, Math.max(1, Math.min(1000, count)))
  const prices = await getRepository(PriceEntity).find({
    where: {
      denom,
      datetime: In(queryDatetimes)
    },
    order: { datetime: 'ASC' }
  })

  const lastPrice = await getRepository(PriceEntity).findOne({
    where: {
      denom
    },
    order: { datetime: 'DESC' }
  })

  const denomOneDayBeforePrices = await getOnedayBefore()
  const oneDayVariation =
    lastPrice && denomOneDayBeforePrices[denom] ? minus(lastPrice.price, denomOneDayBeforePrices[denom]) : undefined

  const oneDayVariationRate = lastPrice && oneDayVariation ? div(oneDayVariation, lastPrice.price) : undefined

  // 봉의 시간으로 변경해서 리턴해줌
  const pricesWithTargetDatetime: PriceDataByDate[] = prices.map((price: PriceEntity) => {
    return {
      denom: price.denom,
      datetime: getTargetDatetime(price.datetime, interval),
      price: price.price
    }
  })

  return {
    lastPrice: lastPrice ? lastPrice.price : undefined,
    oneDayVariation,
    oneDayVariationRate,
    prices: pricesWithTargetDatetime
  }
}
