import { getRepository } from 'typeorm'
import { startOfToday, subDays } from 'date-fns'
import { plus, div, times, minus } from 'lib/math'
import { MOVING_AVG_WINDOW_IN_DAYS, DAYS_IN_YEAR } from 'lib/constant'
import memoizeCache from 'lib/memoizeCache'
import { DashboardEntity } from 'orm'
import { getDashboardHistory } from './dashboardHistory'

interface StakingDailyReturn {
  datetime: number
  dailyReturn: string
  annualizedReturn: string
}

async function getStakingReturnUncached(): Promise<StakingDailyReturn[]> {
  const dashboardHistory = await getDashboardHistory()
  let movingAvgSum = '0'
  const stakingReturn = dashboardHistory.reduce((retArray, item: DashboardEntity) => {
    const dailyReturn = Number(item.avgStaking) ? div(plus(item.reward, item.airdrop), item.avgStaking) : '0'
    movingAvgSum = plus(movingAvgSum, dailyReturn)

    if (retArray.length >= MOVING_AVG_WINDOW_IN_DAYS) {
      movingAvgSum = minus(movingAvgSum, retArray[retArray.length - MOVING_AVG_WINDOW_IN_DAYS].dailyReturn)
    }

    const avgDailyReturn = div(
      movingAvgSum,
      retArray.length >= MOVING_AVG_WINDOW_IN_DAYS ? MOVING_AVG_WINDOW_IN_DAYS : retArray.length + 1
    )
    const annualizedReturn = times(avgDailyReturn, DAYS_IN_YEAR)

    retArray.push({
      datetime: item.timestamp.getTime(),
      dailyReturn,
      annualizedReturn
    })
    return retArray
  }, [] as StakingDailyReturn[])

  return stakingReturn
}

// We will clear memoization at the beginning of each days
export default memoizeCache(getStakingReturnUncached, { promise: true, maxAge: 3600 * 1000 /* 1 hour */ })

export async function getAirdropAnnualAvgReturn(): Promise<string> {
  const { avgReturn } = await getRepository(DashboardEntity)
    .createQueryBuilder()
    .select('SUM(airdrop / avg_staking) * 365 / COUNT(*)', 'avgReturn')
    .where('timestamp >= :date', { date: subDays(startOfToday(), 33) })
    .andWhere('avg_staking != 0')
    .getRawOne()

  return avgReturn
}
