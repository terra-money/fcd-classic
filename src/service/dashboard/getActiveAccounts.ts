import { startOfToday, subDays } from 'date-fns'
import { getConnection } from 'typeorm'

import { DashboardEntity } from 'orm'

import memoizeCache from 'lib/memoizeCache'
import { getQueryDateTime } from 'lib/time'

import { getDashboardHistory } from './dashboardHistory'

async function getTotalActiveAccountUncached(daysBefore?: number): Promise<number> {
  let subQuery = `SELECT DISTINCT account FROM account_tx WHERE timestamp < '${getQueryDateTime(startOfToday())}'`

  if (daysBefore) {
    subQuery = `${subQuery} AND timestamp >= '${getQueryDateTime(subDays(startOfToday(), daysBefore))}'`
  }

  const rawQuery = `SELECT COUNT(*) AS total_active_account FROM (${subQuery}) AS t`

  const result = await getConnection().query(rawQuery)

  return result.length ? Number(result[0].total_active_account) : 0
}

// TODO: Need a way to invalidate cache after 00:00

const getTotalActiveAccount = memoizeCache(getTotalActiveAccountUncached, {
  promise: true,
  maxAge: 60 * 60 * 1000, // 1 hour cache
  preFetch: 0.75 // fetch again after 45 mins
})

export default async function getActiveAccounts(daysBefore?: number): Promise<AccountStatReturn> {
  const dashboardHistory = await getDashboardHistory(daysBefore)
  const total = await getTotalActiveAccount(daysBefore)

  const periodicActive = dashboardHistory.map((item: DashboardEntity) => ({
    datetime: item.timestamp.getTime(),
    value: item.activeAccount
  }))

  return {
    total,
    periodic: periodicActive
  }
}
