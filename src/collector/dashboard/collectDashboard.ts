import { startOfToday, subDays, addDays } from 'date-fns'
import { getRepository, DeepPartial } from 'typeorm'

import { DashboardEntity } from 'orm'
import { getStakingReturnByDay } from './stakingReturn'
import { getAccountCountByDay } from './accountGrowth'
import { getBlockRewardsByDay } from './blockReward'
import { getTxVolumeByDay } from './txVolume'
import { getDateFromDateTime } from './helpers'
import config from 'config'
import { collectorLogger as logger } from 'lib/logger'

const PREVIOUS_DAYS_TO_CALCULATE = 5

export async function collectDashboard() {
  logger.info('Dashboard collector started...')
  const [accountGrowth, taxRewards, stakingReturn, transactionVol] = await Promise.all([
    getAccountCountByDay(PREVIOUS_DAYS_TO_CALCULATE),
    getBlockRewardsByDay(PREVIOUS_DAYS_TO_CALCULATE),
    getStakingReturnByDay(PREVIOUS_DAYS_TO_CALCULATE),
    getTxVolumeByDay(PREVIOUS_DAYS_TO_CALCULATE)
  ])

  const from = subDays(startOfToday(), PREVIOUS_DAYS_TO_CALCULATE)
  const to = startOfToday()
  for (let dayIt = from; dayIt < to; dayIt = addDays(dayIt, 1)) {
    const dashboard = await getRepository(DashboardEntity).findOne({
      chainId: config.CHAIN_ID,
      timestamp: dayIt
    })

    try {
      const dateKey = getDateFromDateTime(dayIt)
      const dashboardEntityObj: DeepPartial<DashboardEntity> = {
        timestamp: dayIt,
        chainId: config.CHAIN_ID,
        txVolume: transactionVol[dateKey],
        reward: stakingReturn[dateKey].reward,
        avgStaking: stakingReturn[dateKey].avgStaking,
        taxReward: taxRewards[dateKey],
        activeAccount: accountGrowth[dateKey].activeAccount,
        totalAccount: accountGrowth[dateKey].totalAccount
      }
      if (!dashboard) {
        await getRepository(DashboardEntity).save(dashboardEntityObj)
        logger.info(`Saved dashboard of day ${dayIt.toISOString()}`)
      }
    } catch (error) {
      logger.info(`Failed to save dashboard of day ${dayIt.toISOString()}`)
      logger.error(error)
    }
  }
  logger.info('dashboard collector finished')
}
