import { getConnection } from 'typeorm'
import { startOfDay } from 'date-fns'
import { getQueryDateTime } from 'lib/time'

export async function getAvgPrice(fromTs: number, toTs: number): Promise<DenomMap> {
  const fromStr = getQueryDateTime(startOfDay(fromTs))
  const toStr = getQueryDateTime(startOfDay(toTs))

  const query = `
SELECT denom,
  AVG(price) AS avg_price
FROM price
WHERE datetime >= '${fromStr}'
AND datetime < '${toStr}'
GROUP BY denom`

  const prices = await getConnection().query(query)
  return prices.reduce((acc, item) => {
    acc[item.denom] = item.avg_price
    return acc
  }, {})
}
