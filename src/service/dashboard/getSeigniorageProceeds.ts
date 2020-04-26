import { getRepository, MoreThanOrEqual } from 'typeorm'
import { GeneralInfoEntity } from 'orm'
import { flatten } from 'lodash'
import { getTargetDates } from 'lib/time'

export interface GetSeigniorageParam {}
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
  const targetDates = getTargetDates(count)

  const result = flatten(
    await Promise.all(
      targetDates.map((date: Date) => {
        return getRepository(GeneralInfoEntity).find({
          where: {
            datetime: MoreThanOrEqual(date)
          },
          order: {
            datetime: 'ASC'
          },
          skip: 0,
          take: 1
        })
      })
    )
  )
  return result
    .map((item) => {
      return {
        datetime: item.datetime.getTime(),
        seigniorageProceeds: item.seigniorageProceeds
      }
    })
    .filter((item) => {
      return item.seigniorageProceeds !== null
    })
}
