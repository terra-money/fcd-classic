import { startOfDay, subDays } from 'date-fns'

import { getAccountGrowth, getBlockRewards, getStakingReturn, getTransactionVol } from 'service/dashboard'

const PREVIOUS_DAYS_TO_CALCULATE = 5

export async function cacheDashboard() {
  const [accountGrowth, blockRewards, stakingReturn, transactionVol] = await Promise.all([
    getAccountGrowth(PREVIOUS_DAYS_TO_CALCULATE),
    getBlockRewards(PREVIOUS_DAYS_TO_CALCULATE),
    getStakingReturn(PREVIOUS_DAYS_TO_CALCULATE),
    getTransactionVol(PREVIOUS_DAYS_TO_CALCULATE)
  ])

  const combinedDailyInfos: {
    [date: string]: {}
  } = {}
}
