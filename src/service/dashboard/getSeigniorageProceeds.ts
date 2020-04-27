import { getRepository, Between } from 'typeorm'
import { GeneralInfoEntity } from 'orm'
import { orderBy } from 'lodash'
import { getQueryDateRangeFrom } from 'lib/time'

/**
 * Seigniorage on specific date
 */
interface SeigniorageInfo {
  datetime: number // date in unix
  seigniorageProceeds: string // bigint seigniorage amount
}

/**
 *
 * @param count number of previous days from today for seigniorage history
 */
export default async function getSeigniorageProceeds(count: number): Promise<SeigniorageInfo[]> {
  const queryDateRange = getQueryDateRangeFrom(count)

  const qb = getRepository(GeneralInfoEntity)
    .createQueryBuilder()
    .addSelect('DATE(datetime)', 'date')
    .addSelect('seigniorage_proceeds')
    .where({ datetime: Between(queryDateRange.from, queryDateRange.to) })
    .distinctOn(['date'])
    .orderBy('date', 'ASC')

  const result = await qb.getMany()

  return orderBy(result, ['datetime'], ['desc']).map((item) => ({
    datetime: item.datetime.getTime(),
    seigniorageProceeds: item.seigniorageProceeds
  }))
}
