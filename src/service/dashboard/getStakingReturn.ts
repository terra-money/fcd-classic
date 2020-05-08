import * as memoizee from 'memoizee'
import { chain } from 'lodash'

import { plus, div, times, minus } from 'lib/math'
import { dateFromDateString } from 'lib/time'
import * as lcd from 'lib/lcd'
import { getCountBaseWhereQuery, dashboardRawQuery, getPriceHistory, getPriceObjKey } from './helper'
import { MOVING_AVG_WINDOW_IN_DAYS, DAYS_IN_YEAR } from 'lib/constant'

export interface GetStakingReturnParam {
  count?: number
}

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
  const { issuance } = await lcd.getIssuanceByDenom('uluna')

  const rewardQuery = `SELECT TO_CHAR(DATE_TRUNC('day', datetime), 'YYYY-MM-DD') AS date\
  , denom, SUM(tax) AS tax_sum, SUM(gas) AS gas_sum, SUM(oracle) AS oracle_sum, SUM(sum) AS reward_sum, SUM(commission) AS commission_sum FROM reward \
  ${getCountBaseWhereQuery(requiredPrevDaysHistory)} GROUP BY date, denom ORDER BY date ASC`
  const rewards = await dashboardRawQuery(rewardQuery)

  const priceObj = await getPriceHistory(requiredPrevDaysHistory)

  const bondedTokensQuery = `SELECT TO_CHAR(DATE_TRUNC('day', datetime), 'YYYY-MM-DD') AS date\
  , AVG(staking_ratio) AS avg_staking_ratio, AVG(bonded_tokens) AS avg_bonded_tokens FROM general_info \
  ${getCountBaseWhereQuery(requiredPrevDaysHistory)} GROUP BY date ORDER BY date ASC`

  const bondedTokens = await dashboardRawQuery(bondedTokensQuery)
  const bondedTokensObj = bondedTokens.reduce((acc, item) => {
    acc[item.date] = item.avg_bonded_tokens ? item.avg_bonded_tokens : times(issuance, item.avg_staking_ratio)
    return acc
  }, {})

  const rewardObj = rewards.reduce((acc, item) => {
    if (!priceObj[getPriceObjKey(item.date, item.denom)] && item.denom !== 'uluna') {
      return acc
    }

    const tax =
      item.denom === 'uluna' ? item.tax_sum : div(item.tax_sum, priceObj[getPriceObjKey(item.date, item.denom)])
    const gas =
      item.denom === 'uluna' ? item.gas_sum : div(item.gas_sum, priceObj[getPriceObjKey(item.date, item.denom)])
    const oracle =
      item.denom === 'uluna' ? item.oracle_sum : div(item.oracle_sum, priceObj[getPriceObjKey(item.date, item.denom)])
    const commission =
      item.denom === 'uluna'
        ? item.commission_sum
        : div(item.commission_sum, priceObj[getPriceObjKey(item.date, item.denom)])
    const reward =
      item.denom === 'uluna' ? item.reward_sum : div(item.reward_sum, priceObj[getPriceObjKey(item.date, item.denom)])

    const prev = acc[item.date] || {}

    acc[item.date] = {
      tax: plus(prev.tax, tax),
      gas: plus(prev.gas, gas),
      oracle: plus(prev.oracle, oracle),
      commission: plus(prev.commission, commission),
      reward: plus(prev.reward, reward)
    }

    return acc
  }, {})

  let cummulativeReturnOfMovingAvgWindow = '0'

  const stakingReturns = Object.keys(rewardObj).reduce((acc: StakingDailyReturn[], date) => {
    const staked = bondedTokensObj[date]

    if (staked === '0') {
      return acc
    }

    const rewardSum =
      rewardObj[date].reward === '0' && rewardObj[date].commission === '0'
        ? plus(plus(rewardObj[date].tax, rewardObj[date].gas), rewardObj[date].oracle)
        : rewardObj[date].reward

    const dailyReturn = div(rewardSum, staked)
    cummulativeReturnOfMovingAvgWindow = plus(cummulativeReturnOfMovingAvgWindow, dailyReturn)
    if (acc.length >= MOVING_AVG_WINDOW_IN_DAYS) {
      cummulativeReturnOfMovingAvgWindow = minus(
        cummulativeReturnOfMovingAvgWindow,
        acc[acc.length - MOVING_AVG_WINDOW_IN_DAYS].dailyReturn
      )
    }
    const avgReturn = div(
      cummulativeReturnOfMovingAvgWindow,
      acc.length >= MOVING_AVG_WINDOW_IN_DAYS ? MOVING_AVG_WINDOW_IN_DAYS : acc.length + 1
    )
    const annualizedReturn = times(avgReturn, DAYS_IN_YEAR)

    acc.push({
      datetime: dateFromDateString(date).getTime(),
      dailyReturn,
      annualizedReturn
    })

    return acc
  }, [])

  return count
    ? chain(stakingReturns)
        .drop(stakingReturns.length - count)
        .value()
    : stakingReturns
}

// We will clear memoization at the beginning of each days
export default memoizee(getStakingReturnUncached, { promise: true, maxAge: 86400 * 1000 /* 1 day */ })
