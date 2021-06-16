import { startOfToday, subDays, addDays } from 'date-fns'
import { getRepository } from 'typeorm'

import { getDateFromDateTime } from 'lib/time'
import { collectorLogger as logger } from 'lib/logger'

import config from 'config'
import { DashboardEntity } from 'orm'

import { getStakingReturnByDay } from './stakingReturn'
import { getAccountCountByDay } from './accountGrowth'
import { getBlockRewardsByDay } from './blockReward'
import { getTxVolumeByDay } from './txVolume'

const PREVIOUS_DAYS_TO_CALCULATE = 3

export async function collectDashboard(updateExisting = false) {
  logger.info('Dashboard collector started...')

  const to = startOfToday()
  const from = subDays(to, PREVIOUS_DAYS_TO_CALCULATE)

  const [accountGrowth, taxRewards, stakingReturn, transactionVol] = await Promise.all([
    getAccountCountByDay(PREVIOUS_DAYS_TO_CALCULATE),
    getBlockRewardsByDay(PREVIOUS_DAYS_TO_CALCULATE),
    getStakingReturnByDay(PREVIOUS_DAYS_TO_CALCULATE),
    getTxVolumeByDay(PREVIOUS_DAYS_TO_CALCULATE)
  ])

  for (let dayIt = from; dayIt < to; dayIt = addDays(dayIt, 1)) {
    let dashboard = await getRepository(DashboardEntity).findOne({
      chainId: config.CHAIN_ID,
      timestamp: dayIt
    })

    if (dashboard) {
      if (!updateExisting) {
        logger.info(`Dashboard exists: ${dayIt.toISOString()}`)
        continue
      }
    } else {
      dashboard = new DashboardEntity()
    }

    const dateKey = getDateFromDateTime(dayIt)

    dashboard.timestamp = dayIt
    dashboard.chainId = config.CHAIN_ID
    dashboard.txVolume = transactionVol[dateKey]
    dashboard.reward = stakingReturn[dateKey]?.reward
    dashboard.avgStaking = stakingReturn[dateKey]?.avgStaking
    dashboard.taxReward = taxRewards[dateKey]
    dashboard.activeAccount = accountGrowth[dateKey]?.activeAccount
    dashboard.totalAccount = accountGrowth[dateKey]?.totalAccount

    await getRepository(DashboardEntity)
      .save(dashboard)
      .then(() => {
        logger.info(`Dashboard saved: ${dayIt.toISOString()}`)
      })
      .catch((error) => {
        logger.error(`Dashboard save failed: ${dayIt.toISOString()} ${error.message}`)
      })
  }

  logger.info('Dashboard collector finished')
}
