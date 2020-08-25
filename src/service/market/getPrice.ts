import { getRepository, In, getConnection } from 'typeorm'
import { PriceEntity } from 'orm'
import { default as parseDuration } from 'parse-duration'
import { drop } from 'lodash'

import { getTargetDatetime, getOnedayBefore } from './helper'
import { minus, div } from 'lib/math'
import { getQueryDateTime } from 'lib/time'

const MIN_DURATION = 60000 // 1 min

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

type PriceByInterval = {
  denom: string
  price: number
  datetime: string
  time_div: number
}

async function getAvgPriceByInterval(params: GetPriceParams): Promise<PriceByInterval[]> {
  const now = Date.now()
  const msc = Math.max(MIN_DURATION, parseDuration(params.interval) || MIN_DURATION)
  const intervalInSec = msc / 1000
  const latestTimestamp = now - (now % msc)
  const maxTimeStamp = now + msc * 2 // to make sure not to end up in zero segment of time diff
  const minTimeStamp = latestTimestamp - msc * params.count

  const subTimeQ = `TRUNC((((
    DATE_PART('DAY', $1::TIMESTAMP - datetime::TIMESTAMP) * 24 
    + DATE_PART('HOUR', $1::TIMESTAMP - datetime::TIMESTAMP)) * 60
    + DATE_PART('MINUTE', $1::TIMESTAMP - datetime::TIMESTAMP)) * 60 
    + DATE_PART('SECOND', $1::TIMESTAMP - datetime::TIMESTAMP))/($2))`

  const rawQ = `SELECT denom, AVG(price.price) AS price, MIN(datetime) AS datetime, ${subTimeQ} AS time_div 
    FROM price WHERE denom = $3 AND datetime >= $4 
    GROUP BY denom, time_div ORDER BY time_div DESC`

  const prices: PriceByInterval[] = await getConnection().query(rawQ, [
    getQueryDateTime(maxTimeStamp),
    intervalInSec,
    params.denom,
    getQueryDateTime(minTimeStamp)
  ])

  return prices.length <= params.count ? prices : drop(prices, prices.length - params.count)
}

export default async function getPrice(params: GetPriceParams): Promise<GetPriceReturn> {
  const { denom, interval } = params
  const prices = await getAvgPriceByInterval(params)
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

  // Return as interval begin time
  const pricesWithTargetDatetime: PriceDataByDate[] = prices.map((price: PriceByInterval) => {
    return {
      denom: price.denom,
      datetime: getTargetDatetime(new Date(price.datetime), interval),
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
