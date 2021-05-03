import { getRepository } from 'typeorm'
import { orderBy } from 'lodash'
import { GeneralInfoEntity } from 'orm'

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
export default async function getSeigniorageProceeds(): Promise<SeigniorageInfo[]> {
  const qb = getRepository(GeneralInfoEntity)
    .createQueryBuilder()
    .addSelect('DATE(datetime)', 'date')
    .addSelect('seigniorage_proceeds')
    .distinctOn(['date'])
    .orderBy('date', 'ASC')

  const result = await qb.getMany()

  return orderBy(result, ['datetime'], ['desc']).map((item) => ({
    datetime: item.datetime.getTime(),
    seigniorageProceeds: item.seigniorageProceeds
  }))
}
