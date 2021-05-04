import { compact } from 'lodash'

import { DashboardEntity } from 'orm'
import { getDashboardHistory } from './dashboardHistory'

export default async function getAccountGrowth(): Promise<AccountGrowthReturn> {
  const dashboardHistory = await getDashboardHistory()

  let cumulativeActiveAccount = 0
  const cumulative = dashboardHistory.map((item: DashboardEntity) => {
    cumulativeActiveAccount = cumulativeActiveAccount + item.activeAccount
    return {
      datetime: item.timestamp.getTime(),
      totalAccountCount: item.totalAccount,
      activeAccountCount: cumulativeActiveAccount
    }
  })

  const periodic: AccountCountInfo[] = compact(
    dashboardHistory.map((item: DashboardEntity, index) => {
      if (index === 0) {
        return
      }

      return {
        datetime: item.timestamp.getTime(),
        totalAccountCount: item.totalAccount - dashboardHistory[index - 1].totalAccount,
        activeAccountCount: item.activeAccount
      }
    })
  )

  return {
    cumulative: cumulative.length ? cumulative.slice(1) : [],
    periodic
  }
}
