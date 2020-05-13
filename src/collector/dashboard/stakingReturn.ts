import { getConnection } from 'typeorm'
import { chain } from 'lodash'

import { MOVING_AVG_WINDOW_IN_DAYS, DAYS_IN_YEAR } from 'lib/constant'
import { getCountBaseWhereQuery, getPriceHistory, getPriceObjKey } from 'service/dashboard'
import * as lcd from 'lib/lcd'
import { times, div, plus, minus } from 'lib/math'
import { dateFromDateString } from 'lib/time'

interface DailyReturnInfo {
  tax: string
  gas: string
  oracle: string
  commission: string
  reward: string
}

interface DailyStakingInfo {
  reward: string // bigint
  avgStaking: string // bigint
}

export async function getStakingReturnByDay(daysBefore?: number): Promise<{ [date: string]: DailyStakingInfo }> {
  const { issuance } = await lcd.getIssuanceByDenom('uluna')

  const rewardQuery = `SELECT TO_CHAR(DATE_TRUNC('day', datetime), 'YYYY-MM-DD') AS date\
  , denom, SUM(tax) AS tax_sum, SUM(gas) AS gas_sum, SUM(oracle) AS oracle_sum, SUM(sum) AS reward_sum, SUM(commission) AS commission_sum FROM reward \
  ${getCountBaseWhereQuery(daysBefore)} GROUP BY date, denom ORDER BY date ASC`
  const rewards = await getConnection().query(rewardQuery)

  const priceObj = await getPriceHistory(daysBefore)

  const bondedTokensQuery = `SELECT TO_CHAR(DATE_TRUNC('day', datetime), 'YYYY-MM-DD') AS date\
  , AVG(staking_ratio) AS avg_staking_ratio, AVG(bonded_tokens) AS avg_bonded_tokens FROM general_info \
  ${getCountBaseWhereQuery(daysBefore)} GROUP BY date ORDER BY date ASC`

  const bondedTokens = await getConnection().query(bondedTokensQuery)

  const bondedTokensObj = bondedTokens.reduce((acc, item) => {
    acc[item.date] = item.avg_bonded_tokens ? item.avg_bonded_tokens : times(issuance, item.avg_staking_ratio)
    return acc
  }, {})

  const rewardObj: {
    [date: string]: DailyReturnInfo
  } = rewards.reduce((acc, item) => {
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
  const stakingReturns = Object.keys(rewardObj).reduce((acc, date) => {
    const staked = bondedTokensObj[date]

    if (staked === '0') {
      return acc
    }

    const rewardSum =
      rewardObj[date].reward === '0' && rewardObj[date].commission === '0'
        ? plus(plus(rewardObj[date].tax, rewardObj[date].gas), rewardObj[date].oracle)
        : rewardObj[date].reward
    // TODO: Need to add a failsafe for not found staked
    acc[date] = {
      reward: rewardSum,
      avgStaking: staked
    }
    return acc
  }, {})
  return stakingReturns
}
