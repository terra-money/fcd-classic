import { getManager, EntityManager } from 'typeorm'
import { parseISO, startOfDay } from 'date-fns'
import config from 'config'
import { DashboardEntity, init as initORM } from 'orm'

import {
  getBlockRewardsByDay,
  getStakingReturnByDay,
  getTxVolumeByDay,
  getAccountCountByDay
} from 'collector/dashboard'

async function getDashboard(mgr: EntityManager, datetime: Date): Promise<DashboardEntity | undefined> {
  const dashboard = await mgr.findOne(DashboardEntity, {
    chainId: config.CHAIN_ID,
    timestamp: datetime
  })
  return dashboard
}

async function populateDashboard() {
  await initORM()

  const mgr = getManager()
  const to = startOfDay(Date.now())

  const txVolumes = await getTxVolumeByDay(mgr, to)
  for (const dateKey of Object.keys(txVolumes)) {
    const date = startOfDay(parseISO(dateKey))
    const dashboard = await getDashboard(mgr, date)
    if (dashboard) {
      console.log('updating tx volume of', dateKey)
      await mgr.update(DashboardEntity, dashboard.id, {
        txVolume: txVolumes[dateKey]
      })
    } else {
      console.log('new tx volume of', dateKey)
      await mgr.save(DashboardEntity, {
        timestamp: date,
        chainId: config.CHAIN_ID,
        txVolume: txVolumes[dateKey]
      })
    }
  }

  const accountGrowth = await getAccountCountByDay(mgr, to, 1)
  for (const dateKey of Object.keys(accountGrowth)) {
    const date = startOfDay(parseISO(dateKey))
    const dashboard = await getDashboard(mgr, date)
    if (dashboard) {
      console.log('updating account growth of', dateKey)
      await mgr.update(DashboardEntity, dashboard.id, {
        activeAccount: accountGrowth[dateKey].activeAccount,
        totalAccount: accountGrowth[dateKey].totalAccount
      })
    } else {
      console.log('new account growth of', dateKey)
      await mgr.save(DashboardEntity, {
        timestamp: date,
        chainId: config.CHAIN_ID,
        activeAccount: accountGrowth[dateKey].activeAccount,
        totalAccount: accountGrowth[dateKey].totalAccount,
        txVolume: {}
      })
    }
  }

  const taxRewards = await getBlockRewardsByDay(mgr, to)
  for (const dateKey of Object.keys(taxRewards)) {
    const date = startOfDay(parseISO(dateKey))
    const dashboard = await getDashboard(mgr, date)
    if (dashboard) {
      console.log('updating tax reward of', dateKey)
      await mgr.update(DashboardEntity, dashboard.id, {
        taxReward: taxRewards[dateKey]
      })
    } else {
      console.log('new tax reward of', dateKey)
      await mgr.save(DashboardEntity, {
        timestamp: date,
        chainId: config.CHAIN_ID,
        taxReward: taxRewards[dateKey],
        txVolume: {}
      })
    }
  }

  const stakingReturns = await getStakingReturnByDay(mgr, to)
  for (const dateKey of Object.keys(stakingReturns)) {
    const date = startOfDay(parseISO(dateKey))
    const dashboard = await getDashboard(mgr, date)
    if (dashboard) {
      console.log('updating staking of', dateKey)
      await mgr.update(DashboardEntity, dashboard.id, {
        avgStaking: stakingReturns[dateKey].avgStaking,
        reward: stakingReturns[dateKey].reward
      })
    } else {
      console.log('new staking of', dateKey)
      await mgr.save(DashboardEntity, {
        timestamp: date,
        chainId: config.CHAIN_ID,
        avgStaking: stakingReturns[dateKey].avgStaking,
        reward: stakingReturns[dateKey].reward,
        txVolume: {}
      })
    }
  }
}

populateDashboard().catch(console.error)
