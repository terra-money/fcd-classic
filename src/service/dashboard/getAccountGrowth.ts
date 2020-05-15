import { compact } from 'lodash'

import { DashboardEntity } from 'orm'
import { getDashboardHistory } from './dashboardHistory'

export default async function getAccountGrowth(count?: number): Promise<AccountGrowthReturn> {
  const dashboardHistory = await getDashboardHistory(count)

  const cumulative = dashboardHistory.map((item: DashboardEntity) => {
    return {
      datetime: item.timestamp.getTime(),
      totalAccountCount: item.totalAccount,
      activeAccountCount: item.activeAccount
    }
  })

  const periodic: AccountCountInfo[] = compact(
    dashboardHistory.map((item: DashboardEntity, i) => {
      if (i === 0) {
        return
      }

      return {
        datetime: item.timestamp.getTime(),
        totalAccountCount: item.totalAccount - dashboardHistory[i - 1].totalAccount,
        activeAccountCount: item.activeAccount - dashboardHistory[i - 1].activeAccount
      }
    })
  )

  return {
    cumulative: cumulative.slice(1),
    periodic
  }
}
