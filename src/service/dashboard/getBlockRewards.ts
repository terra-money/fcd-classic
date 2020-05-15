import { plus } from 'lib/math'
import { getDashboardHistory } from './dashboardHistory'
import { DashboardEntity } from 'orm'

export default async function getBlockRewards(daysBefore?: number): Promise<BlockRewardsReturn> {
  const dashboardHistory = await getDashboardHistory(daysBefore)

  const periodic: BlockRewardSumInfo[] = dashboardHistory.map((dashboard: DashboardEntity) => {
    return {
      datetime: dashboard.timestamp.getTime(),
      blockReward: dashboard.taxReward
    }
  })
  let cumulativeSum = '0'
  const cumulative: BlockRewardSumInfo[] = dashboardHistory.map((dashboard: DashboardEntity, index) => {
    cumulativeSum = plus(cumulativeSum, dashboard.taxReward)
    return {
      datetime: dashboard.timestamp.getTime(),
      blockReward: cumulativeSum
    }
  })

  return {
    periodic,
    cumulative
  }
}
