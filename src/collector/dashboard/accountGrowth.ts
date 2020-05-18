import { subDays, startOfToday, endOfDay } from 'date-fns'
import { getRepository } from 'typeorm'

import { getDateFromDateTime, convertDbTimestampToDate } from './helpers'
import { AccountTxEntity } from 'orm'

export interface AccountCountInfo {
  totalAccount: number
  activeAccount: number
}

async function getTotalAccount(
  until: Date
): Promise<{
  date: string
  total_account_count: number
}> {
  const queryBuilder = getRepository(AccountTxEntity)
    .createQueryBuilder()
    .select('count(distinct account)', 'total_account_count')
    .where('timestamp <= :until ', { until: endOfDay(until) })

  const result: {
    total_account_count: number
  }[] = await queryBuilder.getRawMany()

  return {
    date: getDateFromDateTime(until),
    total_account_count: result.length ? result[0].total_account_count : 0
  }
}

async function getDailyActiveAccount(daysBefore?: number): Promise<{ date: string; active_account_count: number }[]> {
  const queryBuilder = getRepository(AccountTxEntity)
    .createQueryBuilder()
    .select(convertDbTimestampToDate('timestamp'), 'date')
    .addSelect('count(distinct account)', 'active_account_count')
    .groupBy('date')
    .orderBy('date', 'ASC')
    .where('timestamp < :today ', { today: startOfToday() })

  if (daysBefore) {
    queryBuilder.andWhere('timestamp >= :from', { from: subDays(startOfToday(), daysBefore) })
  }

  const result: {
    date: string
    active_account_count: number
  }[] = await queryBuilder.getRawMany()

  return result
}

export async function getAccountCountByDay(daysBefore?: number): Promise<{ [date: string]: AccountCountInfo }> {
  const dailyActiveAccount = await getDailyActiveAccount(daysBefore)
  const totalAccount = await Promise.all(dailyActiveAccount.map((item) => getTotalAccount(endOfDay(item.date))))
  const totalAccountMap = totalAccount.reduce((acc, item) => {
    acc[item.date] = item.total_account_count
    return acc
  }, {})

  return dailyActiveAccount.reduce((acc, item) => {
    const dateKey = getDateFromDateTime(new Date(item.date))
    acc[dateKey] = {
      totalAccount: totalAccountMap[dateKey],
      activeAccount: item.active_account_count
    }
    return acc
  }, {})
}
