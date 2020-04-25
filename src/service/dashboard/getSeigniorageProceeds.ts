import { getRepository, MoreThanOrEqual } from 'typeorm'
import { GeneralInfoEntity } from 'orm'
import * as moment from 'moment'
import { getTargetDates } from './helper'
import { flatten } from 'lodash'

export interface GetSeigniorageParam {
  count: number //  number of previous days from today for seigniorage history
}
/**
 * Seigniorage on specific date
 */

interface SeigniorageInfo {
  datetime: number // date in unix
  seigniorageProceeds: string // bigint seigniorage amount
}

export default async function getSeigniorageProceeds(option: GetSeigniorageParam): Promise<SeigniorageInfo[]> {
  const { count } = option

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
        datetime: moment(item.datetime).valueOf(),
        seigniorageProceeds: item.seigniorageProceeds
      }
    })
    .filter((item) => {
      return item.seigniorageProceeds !== null
    })
}
