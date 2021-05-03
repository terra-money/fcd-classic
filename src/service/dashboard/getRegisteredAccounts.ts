import { DashboardEntity } from 'orm'
import { getDashboardHistory } from './dashboardHistory'

export default async function getRegisteredAccounts(): Promise<AccountStatReturn> {
  const dashboards = await getDashboardHistory()

  if (dashboards.length === 0) {
    return {
      total: 0,
      periodic: [],
      cumulative: []
    }
  }

  const cumulativeRegistered: CountInfoByDate[] = dashboards.map((item: DashboardEntity) => ({
    datetime: item.timestamp.getTime(),
    value: item.totalAccount
  }))

  const periodicRegistered: CountInfoByDate[] = dashboards.map((item: DashboardEntity, index) => ({
    datetime: item.timestamp.getTime(),
    value: item.totalAccount - (index > 0 ? dashboards[index - 1].totalAccount : 0)
  }))

  return {
    total: dashboards[dashboards.length - 1].totalAccount,
    periodic: periodicRegistered.slice(1),
    cumulative: cumulativeRegistered.slice(1)
  }
}
