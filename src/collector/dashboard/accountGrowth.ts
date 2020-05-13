import { subDays, startOfToday } from 'date-fns'
import { getRepository } from 'typeorm'

import { getDateFromDateTime, convertDbTimestampToDate } from './helpers'
import { GeneralInfoEntity } from 'orm'

export interface AccountCountInfo {
  totalAccount: number
  activeAccount: number
}

export async function getAccountCountByDay(daysBefore?: number): Promise<{ [date: string]: AccountCountInfo }> {
  const queryBuilder = getRepository(GeneralInfoEntity)
    .createQueryBuilder()
    .select(convertDbTimestampToDate('datetime'), 'date')
    .addSelect('MAX(total_account_count)', 'total_account')
    .addSelect('MAX(active_account_count)', 'active_account')
    .groupBy('date')
    .orderBy('date', 'DESC')
    .where('datetime < :today ', { today: startOfToday() })

  if (daysBefore) {
    queryBuilder.andWhere('datetime >= :from', { from: subDays(startOfToday(), daysBefore) })
  }

  const result: {
    total_account: number
    active_account: number
    date: string
  }[] = await queryBuilder.getRawMany()

  return result.reduce((acc, item) => {
    acc[getDateFromDateTime(new Date(item.date))] = {
      totalAccount: item.total_account,
      activeAccount: item.active_account
    }
    return acc
  }, {})
}
