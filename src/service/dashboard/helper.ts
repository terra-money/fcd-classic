import * as memoizee from 'memoizee'
import { getConnection } from 'typeorm'
import { getQueryDateRangeFrom } from 'lib/time'

export const getPriceObjKey = (date: string, denom: string): string => `${date}${denom}`

async function dashboardRawQueryUncached(query: string): Promise<any> {
  return getConnection().query(query)
}

export const dashboardRawQuery = memoizee(dashboardRawQueryUncached, { promise: true, maxAge: 3600000 })

/**
 *
 * @param { number } dayCount days of history from today
 *
 * @returns { Map<string, string> } keys format: {date}{denom} => YYYY-MM-DDdenom and
 * values format: bigint { average denom value on that date }
 */

export async function getPriceHistory(dayCount?: number): Promise<{ [key: string]: string }> {
  const whereQuery = dayCount
    ? `where datetime >= '${getQueryDateRangeFrom(dayCount).from}' and datetime < '${
        getQueryDateRangeFrom(dayCount).to
      }'`
    : ``

  const priceQuery = `SELECT TO_CHAR(DATE_TRUNC('day', datetime), 'YYYY-MM-DD') AS date\
  , denom, AVG(price) AS avg_price FROM price ${whereQuery} GROUP BY date, denom ORDER BY date DESC`
  const prices = await dashboardRawQuery(priceQuery)

  return prices.reduce((acc, item) => {
    acc[getPriceObjKey(item.date, item.denom)] = item.avg_price
    return acc
  }, {})
}

export function getCountBaseWhereQuery(count?: number) {
  return count
    ? `WHERE datetime >= '${getQueryDateRangeFrom(count).from}' AND datetime < '${getQueryDateRangeFrom(count).to}'`
    : `WHERE datetime < '${getQueryDateRangeFrom(1).to}'`
}
