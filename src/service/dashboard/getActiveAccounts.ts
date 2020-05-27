import { startOfToday, subDays } from 'date-fns'
import { getConnection } from 'typeorm'
import * as memoizee from 'memoizee'

import { getQueryDateTime } from 'lib/time'
import { DashboardEntity } from 'orm'
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

const getTotalActiveAccount = memoizee(getTotalActiveAccountUncached, {
  promise: true,
  maxAge: 60 * 10 * 1000,
  preFetch: true
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
