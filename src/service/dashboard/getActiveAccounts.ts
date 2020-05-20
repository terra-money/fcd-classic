import { startOfToday, subDays } from 'date-fns'
import { getConnection } from 'typeorm'

import { getQueryDateTime } from 'lib/time'
import { getDashboardHistory } from './dashboardHistory'
import { DashboardEntity } from 'orm'
import { parseInt } from 'lodash'

async function getTotalActiveAccount(daysBefore?: number): Promise<number> {
  let subQuery = `select distinct account from account_tx where timestamp < '${getQueryDateTime(startOfToday())}'`

  if (daysBefore) {
    subQuery = `${subQuery} and timestamp >= '${getQueryDateTime(subDays(startOfToday(), daysBefore))}'`
  }

  const rawQuery = `select count(*) as total_active_account from (${subQuery}) as t`

  const result = await getConnection().query(rawQuery)

  return result.length ? Number(result[0].total_active_account) : 0
}

export default async function getActiveAccounts(daysBefore?: number): Promise<AccountStatReturn> {
  const dashboardHistory = await getDashboardHistory(daysBefore)
  const total = await getTotalActiveAccount(daysBefore)

  const periodicActive = dashboardHistory.map((item: DashboardEntity) => {
    return {
      datetime: item.timestamp.getTime(),
      value: item.activeAccount
    }
  })

  return {
    total,
    periodic: periodicActive
  }
}
