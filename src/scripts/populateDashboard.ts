import { getRepository, getConnection } from 'typeorm'
import { startOfDay, startOfToday } from 'date-fns'

import { DashboardEntity, init as initORM } from 'orm'
import {
  getAccountCountByDay,
  getBlockRewardsByDay,
  getStakingReturnByDay,
  getTxVolumeByDay,
  getDateFromDateTime
} from 'collector/dashboard'
import { getQueryDateTime } from 'lib/time'
import config from 'config'

async function getDashboard(datetime: Date): Promise<DashboardEntity | undefined> {
  const dashboard = await getRepository(DashboardEntity).findOne({
    chainId: config.CHAIN_ID,
    timestamp: datetime
  })
  return dashboard
}
// NB: we are using the general infos total account count for populating dashboard because
// getting the total count for everyday from account_tx table is a costly operation which leads to long time.

async function getDailyTotalAccounts(): Promise<{ date: string; total_account_count: number }[]> {
  const rawQuery = `SELECT MAX(total_account_count) AS total_account_count, DATE(datetime) as date 
    FROM general_info WHERE datetime < '${getQueryDateTime(startOfToday())}' GROUP BY date ORDER BY date ASC`

  const result: {
    total_account_count: number
    date: string
  }[] = await getConnection().query(rawQuery)
  return result
}

async function getDailyActiveAccounts(): Promise<{ date: string; active_account_count: number }[]> {
  // EXP: we are using count (SELECT DISTINCT account FROM x) rather COUNT(DISTINCT account) because its is 10 times faster.
  const subQuery = `SELECT DISTINCT account, DATE(timestamp) AS date FROM account_tx WHERE timestamp < '${getQueryDateTime(
    startOfToday()
  )}'`

  const rawQuery = `SELECT COUNT(*) AS active_account_count, t.date AS date FROM (${subQuery}) AS t GROUP BY t.date ORDER BY t.date ASC`
  const result: {
    date: string
    active_account_count: number
  }[] = await getConnection().query(rawQuery)
  return result
}

async function accountCountHistory(): Promise<{
  [date: string]: {
    activeAccount: number
    totalAccount: number
  }
}> {
  const totalAccount = await getDailyTotalAccounts()
  const activeAccount = await getDailyActiveAccounts()

  const totalAccountMap = totalAccount.reduce((acc, info) => {
    const dateKey = getDateFromDateTime(new Date(info.date))
    acc[dateKey] = info.total_account_count
    return acc
  }, {})

  const res = activeAccount.reduce((acc, info) => {
    const dateKey = getDateFromDateTime(new Date(info.date))
    if (totalAccountMap[dateKey]) {
      acc[dateKey] = {
        activeAccount: info.active_account_count,
        totalAccount: totalAccountMap[dateKey]
      }
    }
    return acc
  }, {})
  return res
}

async function populateDashboard() {
  await initORM()
  const accountGrowth = await accountCountHistory()
  console.log(accountGrowth)

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
