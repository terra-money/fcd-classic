import { default as parseDuration } from 'parse-duration'
import { getRepository } from 'typeorm'
import { PriceEntity } from 'orm'

const MIN_DURATION = 60000

export function getTargetDatetime(datetime: Date, interval: string): number {
  const msc = Math.max(MIN_DURATION, parseDuration(interval) || MIN_DURATION)
  return Number(datetime) - (Number(datetime) % msc)
}

export async function getLastDayPrices(): Promise<DenomMap> {
  const latestPrice = await getRepository(PriceEntity).findOneOrFail({ order: { datetime: 'DESC' } })
  const oneDayBefore = getTargetDatetime(latestPrice.datetime, '1d') - MIN_DURATION
  const denomPrices = await getRepository(PriceEntity).find({
    where: {
      datetime: new Date(getTargetDatetime(new Date(oneDayBefore), '1m'))
    },
    order: {
      datetime: 'DESC'
    }
  })

  return denomPrices.reduce((acc, curr) => {
    if (acc[curr.denom]) return acc
    return { ...acc, [curr.denom]: curr.price }
  }, {})
}
