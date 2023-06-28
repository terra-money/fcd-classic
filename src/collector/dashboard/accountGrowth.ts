import { subDays, endOfDay } from 'date-fns'
import { getConnection } from 'typeorm'

import { getQueryDateTime, getDateFromDateTime } from 'lib/time'
import { getLatestDateOfAccountTx } from './helpers'

export interface DailyAccountStat {
  totalAccount: number
  activeAccount: number
}

async function getTotalAccount(until: Date): Promise<{
  date: string
  total_account_count: number
}> {
  // EXP: we are using count (SELECT DISTINCT account FROM x) rather COUNT(DISTINCT account) because its is 10 times faster.
  const subQuery = `SELECT DISTINCT account FROM account_tx WHERE timestamp <= '${getQueryDateTime(endOfDay(until))}'`
  const rawQuery = `SELECT COUNT(*) AS total_account_count FROM (${subQuery}) AS t;`

  const result: {
    total_account_count: number
  }[] = await getConnection().query(rawQuery)
  return {
    date: getDateFromDateTime(until),
    total_account_count: result.length ? result[0].total_account_count : 0
  }
}

export async function getDailyActiveAccount(
  daysBefore?: number
): Promise<{ date: Date; active_account_count: number }[]> {
  const latestDate = await getLatestDateOfAccountTx()

  // EXP: we are using count (SELECT DISTINCT account FROM x) rather COUNT(DISTINCT account) because its is 10 times faster.
  let subQuery = `SELECT DISTINCT account, DATE(timestamp) AS date FROM account_tx WHERE timestamp < '${getQueryDateTime(
    latestDate
  )}'`

  if (daysBefore) {
    subQuery = `${subQuery} and timestamp >= '${getQueryDateTime(subDays(latestDate, daysBefore))}'`
  }

  const rawQuery = `SELECT COUNT(*) AS active_account_count, t.date AS date FROM (${subQuery}) AS t GROUP BY t.date ORDER BY t.date ASC`
  const result: {
    date: Date
    active_account_count: number
  }[] = await getConnection().query(rawQuery)
  return result
}

export async function getAccountCountByDay(daysBefore?: number): Promise<{ [date: string]: DailyAccountStat }> {
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
