import { subDays, addDays, startOfDay } from 'date-fns'
import { getManager } from 'typeorm'

import { getDateFromDateTime } from 'lib/time'
import { collectorLogger as logger } from 'lib/logger'

import config from 'config'
import { DashboardEntity } from 'orm'

import { getStakingReturnByDay } from './stakingReturn'
import { getAccountCountByDay } from './accountGrowth'
import { getBlockRewardsByDay } from './blockReward'
import { getTxVolumeByDay } from './txVolume'

const PREVIOUS_DAYS_TO_CALCULATE = 1

export async function collectDashboard(timestamp: number) {
  const mgr = getManager()
  const to = startOfDay(timestamp)
  const from = subDays(to, PREVIOUS_DAYS_TO_CALCULATE)

  const [accountGrowth, taxRewards, stakingReturn, transactionVol] = await Promise.all([
    getAccountCountByDay(mgr, to, PREVIOUS_DAYS_TO_CALCULATE),
    getBlockRewardsByDay(mgr, to, PREVIOUS_DAYS_TO_CALCULATE),
    getStakingReturnByDay(mgr, to, PREVIOUS_DAYS_TO_CALCULATE),
    getTxVolumeByDay(mgr, to, PREVIOUS_DAYS_TO_CALCULATE)
  ])

  for (let dayIt = from; dayIt.getTime() < to.getTime(); dayIt = addDays(dayIt, 1)) {
    let dashboard = await mgr.findOne(DashboardEntity, {
      chainId: config.CHAIN_ID,
      timestamp: dayIt
    })

    if (!dashboard) {
      dashboard = new DashboardEntity()
    }

    const dateKey = getDateFromDateTime(dayIt)
    dashboard.timestamp = dayIt
    dashboard.chainId = config.CHAIN_ID
    dashboard.txVolume = transactionVol[dateKey] || {}
    dashboard.reward = stakingReturn[dateKey]?.reward
    dashboard.avgStaking = stakingReturn[dateKey]?.avgStaking
    dashboard.taxReward = taxRewards[dateKey]
    dashboard.activeAccount = accountGrowth[dateKey]?.activeAccount
    dashboard.totalAccount = accountGrowth[dateKey]?.totalAccount

    await mgr
      .save(DashboardEntity, dashboard)
      .then(() => {
        logger.info(`collectDashboard: success ${dayIt}`)
      })
      .catch((error) => {
        logger.error(`collectDashboard: failed ${dayIt}`)
        throw error
      })
  }
}
