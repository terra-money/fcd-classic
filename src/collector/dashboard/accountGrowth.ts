import { subDays, startOfToday, endOfDay } from 'date-fns'
import { getConnection } from 'typeorm'

import { getDateFromDateTime } from './helpers'
import { getQueryDateTime } from 'lib/time'

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
  // EXP: we are using count (select distinct account from x) rather count(distinct account) because its is 10 times faster.

  const subQuery = `select distinct account from account_tx where timestamp <= '${getQueryDateTime(endOfDay(until))}'`
  const rawQuery = `select count(*) as total_account_count from (${subQuery}) as temp;`

  const result: {
    total_account_count: number
  }[] = await getConnection().query(rawQuery)
  return {
    date: getDateFromDateTime(until),
    total_account_count: result.length ? result[0].total_account_count : 0
  }
}

async function getDailyActiveAccount(daysBefore?: number): Promise<{ date: string; active_account_count: number }[]> {
  // EXP: we are using count (select distinct account from x) rather count(distinct account) because its is 10 times faster.

  let subQuery = `select distinct account ,date(timestamp) as date from account_tx where timestamp < '${getQueryDateTime(
    startOfToday()
  )}'`

  if (daysBefore) {
    subQuery = `${subQuery} and timestamp >= '${getQueryDateTime(subDays(startOfToday(), daysBefore))}'`
  }

  const rawQuery = `select count(*) as active_account_count, t.date as date from (${subQuery}) as t group by t.date order by t.date asc`
  const result: {
    date: string
    active_account_count: number
  }[] = await getConnection().query(rawQuery)
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
