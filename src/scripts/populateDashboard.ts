import { getRepository } from 'typeorm'
import { parseISO, startOfDay } from 'date-fns'
import config from 'config'
import { DashboardEntity, init as initORM } from 'orm'

import {
  getBlockRewardsByDay,
  getStakingReturnByDay,
  getTxVolumeByDay,
  getAccountCountByDay
} from 'collector/dashboard'

async function getDashboard(datetime: Date): Promise<DashboardEntity | undefined> {
  const dashboard = await getRepository(DashboardEntity).findOne({
    chainId: config.CHAIN_ID,
    timestamp: datetime
  })
  return dashboard
}

async function populateDashboard() {
  await initORM()

  const txVolumes = await getTxVolumeByDay()
  for (const dateKey of Object.keys(txVolumes)) {
    const date = startOfDay(parseISO(dateKey))
    const dashboard = await getDashboard(date)
    if (dashboard) {
      console.log('updating tx volume of', dateKey)
      await getRepository(DashboardEntity).update(dashboard.id, {
        txVolume: txVolumes[dateKey]
      })
    } else {
      console.log('new tx volume of', dateKey)
      await getRepository(DashboardEntity).save({
        timestamp: date,
        chainId: config.CHAIN_ID,
        txVolume: txVolumes[dateKey]
      })
    }
  }

  const accountGrowth = await getAccountCountByDay()
  for (const dateKey of Object.keys(accountGrowth)) {
    const date = startOfDay(parseISO(dateKey))
    const dashboard = await getDashboard(date)
    if (dashboard) {
      console.log('updating account growth of', dateKey)
      await getRepository(DashboardEntity).update(dashboard.id, {
        activeAccount: accountGrowth[dateKey].activeAccount,
        totalAccount: accountGrowth[dateKey].totalAccount
      })
    } else {
      console.log('new account growth of', dateKey)
      await getRepository(DashboardEntity).save({
        timestamp: date,
        chainId: config.CHAIN_ID,
        activeAccount: accountGrowth[dateKey].activeAccount,
        totalAccount: accountGrowth[dateKey].totalAccount
      })
    }
  }

  const taxRewards = await getBlockRewardsByDay()
  for (const dateKey of Object.keys(taxRewards)) {
    const date = startOfDay(parseISO(dateKey))
    const dashboard = await getDashboard(date)
    if (dashboard) {
      console.log('updating tax reward of', dateKey)
      await getRepository(DashboardEntity).update(dashboard.id, {
        taxReward: taxRewards[dateKey]
      })
    } else {
      console.log('new tax reward of', dateKey)
      await getRepository(DashboardEntity).save({
        timestamp: date,
        chainId: config.CHAIN_ID,
        taxReward: taxRewards[dateKey]
      })
    }
  }

  const stakingReturns = await getStakingReturnByDay()
  for (const dateKey of Object.keys(stakingReturns)) {
    const date = startOfDay(parseISO(dateKey))
    const dashboard = await getDashboard(date)
    if (dashboard) {
      console.log('updating staking of', dateKey)
      await getRepository(DashboardEntity).update(dashboard.id, {
        avgStaking: stakingReturns[dateKey].avgStaking,
        reward: stakingReturns[dateKey].reward
      })
    } else {
      console.log('new staking of', dateKey)
      await getRepository(DashboardEntity).save({
        timestamp: date,
        chainId: config.CHAIN_ID,
        avgStaking: stakingReturns[dateKey].avgStaking,
        reward: stakingReturns[dateKey].reward
      })
    }
  }
}

populateDashboard().catch(console.error)
