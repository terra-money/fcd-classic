import { DashboardEntity } from 'orm'
import { getDashboardHistory } from './dashboardHistory'

export default async function getActiveAccounts(): Promise<AccountStatReturn> {
  const dashboardHistory = await getDashboardHistory()
  const periodicActive = dashboardHistory.map((item: DashboardEntity) => ({
    datetime: item.timestamp.getTime(),
    value: item.activeAccount
  }))

  return {
    total: dashboardHistory.length ? dashboardHistory[dashboardHistory.length - 1].totalAccount : 0,
    periodic: periodicActive
  }
}
