import * as memoizee from 'memoizee'
import { chain } from 'lodash'

import { DashboardEntity } from 'orm'
import { plus, div, times, minus } from 'lib/math'
import { MOVING_AVG_WINDOW_IN_DAYS, DAYS_IN_YEAR } from 'lib/constant'
import { getDashboardHistory } from './dashboardHistory'

interface StakingDailyReturn {
  datetime: number
  dailyReturn: string
  annualizedReturn: string
}

export async function getStakingReturnUncached(count?: number): Promise<StakingDailyReturn[]> {
  let requiredPrevDaysHistory

  if (count) {
    requiredPrevDaysHistory = count + MOVING_AVG_WINDOW_IN_DAYS
  }

  const dashboardHistory = await getDashboardHistory(requiredPrevDaysHistory)
  let movingAvgSum = '0'
  const stakingReturn = dashboardHistory.reduce((retArray, item: DashboardEntity) => {
    const dailyReturn = div(item.reward, item.avgStaking)
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

  return count
    ? chain(stakingReturn)
        .drop(stakingReturn.length - count)
        .value()
    : stakingReturn
}

// We will clear memoization at the beginning of each days
export default memoizee(getStakingReturnUncached, { promise: true, maxAge: 3600 * 1000 /* 1 hour */ })
