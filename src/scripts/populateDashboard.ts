import { getRepository } from 'typeorm'
import { startOfDay } from 'date-fns'

import { DashboardEntity, init as initORM } from 'orm'
import {
  getAccountCountByDay,
  getBlockRewardsByDay,
  getStakingReturnByDay,
  getTxVolumeByDay
} from 'collector/dashboard'
import config from 'config'

async function getDashboard(datetime: Date): Promise<DashboardEntity | undefined> {
  const dashboard = await getRepository(DashboardEntity).findOne({
    chainId: config.CHAIN_ID,
    timestamp: datetime
  })
  return dashboard
}

async function populateDashboard() {
  await initORM()
  const accountGrowth = await getAccountCountByDay()

  for (const dateKey of Object.keys(accountGrowth)) {
    const date = startOfDay(dateKey)
    const dashboard = await getDashboard(date)
    if (dashboard) {
      console.log('updating ac growth date ', dateKey)
      await getRepository(DashboardEntity).update(dashboard.id, {
        activeAccount: accountGrowth[dateKey].activeAccount,
        totalAccount: accountGrowth[dateKey].totalAccount
      })
    } else {
      console.log('New insert of ac growth ', dateKey)
      await getRepository(DashboardEntity).save({
        timestamp: date,
        chainId: config.CHAIN_ID,
        activeAccount: accountGrowth[dateKey].activeAccount,
        totalAccount: accountGrowth[dateKey].totalAccount
      })
    }
  }
  // save block rewards.
  const taxRewards = await getBlockRewardsByDay()

  for (const dateKey of Object.keys(taxRewards)) {
    const date = startOfDay(dateKey)
    const dashboard = await getDashboard(date)
    if (dashboard) {
      console.log('updating tax reward of date ', dateKey)
      await getRepository(DashboardEntity).update(dashboard.id, {
        taxReward: taxRewards[dateKey]
      })
    } else {
      console.log('New insert tax reward of ', dateKey)
      await getRepository(DashboardEntity).save({
        timestamp: date,
        chainId: config.CHAIN_ID,
        taxReward: taxRewards[dateKey]
      })
    }
  }

  // save tx volume
  const txVolumes = await getTxVolumeByDay()
  for (const dateKey of Object.keys(txVolumes)) {
    const date = startOfDay(dateKey)
    const dashboard = await getDashboard(date)
    if (dashboard) {
      console.log('updating tx volume of date ', dateKey)
      await getRepository(DashboardEntity).update(dashboard.id, {
        txVolume: txVolumes[dateKey]
      })
    } else {
      console.log('New insert  tx volume of ', dateKey)
      await getRepository(DashboardEntity).save({
        timestamp: date,
        chainId: config.CHAIN_ID,
        txVolume: txVolumes[dateKey]
      })
    }
  }

  const stakingReturns = await getStakingReturnByDay()
  for (const dateKey of Object.keys(stakingReturns)) {
    const date = startOfDay(dateKey)
    const dashboard = await getDashboard(date)
    if (dashboard) {
      console.log('updating staking of date ', dateKey)
      await getRepository(DashboardEntity).update(dashboard.id, {
        avgStaking: stakingReturns[dateKey].avgStaking,
        reward: stakingReturns[dateKey].reward
      })
    } else {
      console.log('New insert staking of ', dateKey)
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
