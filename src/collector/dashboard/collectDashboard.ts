import { startOfToday, subDays, addDays } from 'date-fns'
import { getRepository, DeepPartial } from 'typeorm'

import { getDateFromDateTime } from 'lib/time'
import { collectorLogger as logger } from 'lib/logger'

import config from 'config'
import { DashboardEntity } from 'orm'

import { getStakingReturnByDay } from './stakingReturn'
import { getAccountCountByDay } from './accountGrowth'
import { getBlockRewardsByDay } from './blockReward'
import { getTxVolumeByDay } from './txVolume'

const PREVIOUS_DAYS_TO_CALCULATE = 3

export async function collectDashboard() {
  logger.info('Dashboard collector started...')

  const to = startOfToday()
  const from = subDays(to, PREVIOUS_DAYS_TO_CALCULATE)

  const [accountGrowth, taxRewards, stakingReturn, transactionVol] = await Promise.all([
    getAccountCountByDay(PREVIOUS_DAYS_TO_CALCULATE),
    getBlockRewardsByDay(PREVIOUS_DAYS_TO_CALCULATE),
    getStakingReturnByDay(PREVIOUS_DAYS_TO_CALCULATE),
    getTxVolumeByDay(PREVIOUS_DAYS_TO_CALCULATE)
  ])

  let hasPreviousEntry = false

  for (let dayIt = from; dayIt < to; dayIt = addDays(dayIt, 1)) {
    const dashboard = await getRepository(DashboardEntity).findOne({
      chainId: config.CHAIN_ID,
      timestamp: dayIt
    })

    if (dashboard) {
      logger.info(`Dashboard data of date ${dayIt} already exists`)
      continue
    }
    let dashboardEntityObj: DeepPartial<DashboardEntity> | undefined = undefined
    // trying to build entity object
    try {
      const dateKey = getDateFromDateTime(dayIt)
      dashboardEntityObj = {
        timestamp: dayIt,
        chainId: config.CHAIN_ID,
        txVolume: transactionVol[dateKey],
        reward: stakingReturn[dateKey].reward,
        avgStaking: stakingReturn[dateKey].avgStaking,
        taxReward: taxRewards[dateKey],
        activeAccount: accountGrowth[dateKey].activeAccount,
        totalAccount: accountGrowth[dateKey].totalAccount
      }
      hasPreviousEntry = true
    } catch (error) {
      logger.info(`Failed to get dashboard data of day ${dayIt.toISOString()}`)
      // former entry not found means has an error
      if (hasPreviousEntry) {
        logger.error(error)
      }
    }
    // storing data
    try {
      if (dashboardEntityObj) {
        await getRepository(DashboardEntity).save(dashboardEntityObj)
        logger.info(`Saved dashboard of day ${dayIt.toISOString()}`)
      }
    } catch (error) {
      logger.error(`Failed to store dashboard entity of date ${dayIt}`)
      logger.error(error)
    }
  }
  logger.info('dashboard collector finished')
}
