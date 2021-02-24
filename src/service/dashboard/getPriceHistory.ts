import { getConnection } from 'typeorm'

import { getQueryDateRangeFrom } from 'lib/time'
import memoizeCache from 'lib/memoizeCache'

export const getPriceObjKey = (date: string, denom: string): string => `${date}${denom}`

/**
 *
 * @param { number } dayCount days of history from today
 *
 * @returns { Map<string, string> } keys format: {date}{denom} => YYYY-MM-DDdenom and
 * values format: bigint { average denom value on that date }
 */

export async function getPriceHistoryUncached(dayCount?: number): Promise<{ [key: string]: string }> {
  const whereQuery = dayCount
    ? `WHERE datetime >= '${getQueryDateRangeFrom(dayCount).from}' and datetime < '${
        getQueryDateRangeFrom(dayCount).to
      }'`
    : ``

  const priceQuery = `SELECT TO_CHAR(DATE_TRUNC('day', datetime), 'YYYY-MM-DD') AS date\
  , denom, AVG(price) AS avg_price FROM price ${whereQuery} GROUP BY date, denom ORDER BY date DESC`
  const prices = await getConnection().query(priceQuery)

  return prices.reduce((acc, item) => {
    acc[getPriceObjKey(item.date, item.denom)] = item.avg_price
    return acc
  }, {})
}

const getPriceHistory = memoizeCache(getPriceHistoryUncached, { promise: true, maxAge: 60 * 1000, preFetch: 0.66 })

export default getPriceHistory
