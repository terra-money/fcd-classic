import { getConnection } from 'typeorm'
import { getQueryDateRangeFrom } from 'lib/time'

export async function dashboardRawQuery(query: string): Promise<any> {
  return getConnection().query(query)
}

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
    ? `where datetime >= '${getQueryDateRangeFrom(count).from}' and datetime < '${getQueryDateRangeFrom(count).to}'`
    : `where datetime < '${getQueryDateRangeFrom(1).to}'`
}
