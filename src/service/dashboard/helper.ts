import * as moment from 'moment'
import * as memoizee from 'memoizee'
import { getConnection } from 'typeorm'

export function getTargetDatetimeRange(count: number): DateRange {
  const today = moment().startOf('day')
  return {
    to: today.format('YYYY-MM-DD'),
    from: today.subtract(count, 'day').format('YYYY-MM-DD')
  }
}

export function getTargetDates(count: number): Date[] {
  const targets: Date[] = []
  const today = moment().startOf('day')

  targets.push(today.toDate())
  for (let i = 0; i < count - 1; i = i + 1) {
    targets.push(today.subtract(1, 'day').toDate())
  }
  return targets
}

async function dashboardRawQueryUncached(query: string): Promise<object | object[]> {
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
    ? `where datetime >= '${getTargetDatetimeRange(dayCount).from}' and datetime < '${
        getTargetDatetimeRange(dayCount).to
      }'`
    : ``

  const priceQuery = `select to_char(date_trunc('day', datetime),'YYYY-MM-DD') as date\
  , denom, avg(price) as avg_price from price ${whereQuery} group by 1, 2 order by 1 desc`
  const prices = await dashboardRawQuery(priceQuery)

  const getPriceObjKey = (date: string, denom: string) => `${date}${denom}`
  return prices.reduce((acc, item) => {
    acc[getPriceObjKey(item.date, item.denom)] = item.avg_price
    return acc
  }, {})
}

export function getCountBaseWhereQuery(count?: number) {
  return count
    ? `where datetime >= '${getTargetDatetimeRange(count).from}' and datetime < '${getTargetDatetimeRange(count).to}'`
    : `where datetime < '${getTargetDatetimeRange(1).to}'`
}
