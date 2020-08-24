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

async function getPriceAvg(params: GetPriceParams): Promise<PriceByInterval[]> {
  const now = Date.now()
  const msc = Math.max(MIN_DURATION, parseDuration(params.interval) || MIN_DURATION)
  const intervalInSec = msc / 1000
  const latestTimestamp = now - (now % msc)
  const maxTimeStamp = now + msc * 2 // to make sure not to end up in zero segment of time diff
  const minTimeStamp = latestTimestamp - msc * params.count

  const subTimeQ = `trunc((((
    DATE_PART('day', '${getQueryDateTime(now)}'::timestamp - datetime::timestamp) * 24 
    + DATE_PART('hour', '${getQueryDateTime(now)}'::timestamp - datetime::timestamp)) * 60
    + DATE_PART('minute', '${getQueryDateTime(now)}'::timestamp - datetime::timestamp)) * 60 
    + DATE_PART('second', '${getQueryDateTime(now)}'::timestamp - datetime::timestamp))/(${intervalInSec}))`

  const rawQ = `select denom, avg(price.price) as price, min(datetime) as datetime, ${subTimeQ} as time_div 
    from price where denom = '${params.denom}' and datetime >= '${getQueryDateTime(minTimeStamp)}' 
    group by denom, time_div order by time_div desc`

  const prices: PriceByInterval[] = await getConnection().query(rawQ)

  return prices.length <= params.count ? prices : drop(prices, prices.length - params.count)
}

export default async function getPrice(params: GetPriceParams): Promise<GetPriceReturn> {
  const { denom, interval } = params
  const prices = await getPriceAvg(params)
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
  const pricesWithTargetDatetime: PriceDataByDate[] = prices.map((price: PriceByInterval) => {
    console.log(new Date(price.datetime))
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
