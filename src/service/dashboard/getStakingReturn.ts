import * as moment from 'moment'

import { plus, div, times } from 'lib/math'
import { getCountBaseWhereQuery, dashboardRawQuery, getPriceHistory } from './helper'

export interface GetStakingReturnParam {
  count?: number
}

interface StakingDailyReturn {
  datetime: number
  dailyReturn: string
  annualizedReturn: string
}

export default async function getStakingReturn(option: GetStakingReturnParam): Promise<StakingDailyReturn[]> {
  const { count } = option
  const totalIssued = 780323810831865 + 219456662015307

  const rewardQuery = `select to_char(date_trunc('day', datetime),'YYYY-MM-DD') as date\
  , denom, sum(tax) as tax_sum, sum(gas) as gas_sum, sum(oracle) as oracle_sum, sum(sum) as reward_sum, sum(commission) as commission_sum from reward \
  ${getCountBaseWhereQuery(count)} group by 1, 2 order by 1 desc`
  const rewards = await dashboardRawQuery(rewardQuery)

  const priceObj = await getPriceHistory(count)
  const getPriceObjKey = (date: string, denom: string) => `${date}${denom}`

  const bondedTokensQuery = `select to_char(date_trunc('day', datetime),'YYYY-MM-DD') as date\
  , avg(staking_ratio) as avg_staking_ratio, avg(bonded_tokens) as avg_bonded_tokens from general_info \
  ${getCountBaseWhereQuery(count)} group by 1 order by 1 desc`

  const bondedTokens = await dashboardRawQuery(bondedTokensQuery)
  const bondedTokensObj = bondedTokens.reduce((acc, item) => {
    acc[item.date] = item.avg_bonded_tokens ? item.avg_bonded_tokens : times(totalIssued, item.avg_staking_ratio)
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

    if (acc[item.date]) {
      acc[item.date].tax = plus(acc[item.date].tax, tax)
      acc[item.date].gas = plus(acc[item.date].gas, gas)
      acc[item.date].oracle = plus(acc[item.date].oracle, oracle)
      acc[item.date].commission = plus(acc[item.date].commission, commission)
      acc[item.date].reward = plus(acc[item.date].reward, reward)
    } else {
      acc[item.date] = {
        tax,
        gas,
        oracle,
        commission,
        reward
      }
    }
    return acc
  }, {})

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
    const annualizedReturn = times(dailyReturn, 365)

    acc.unshift({
      datetime: moment(date).valueOf(),
      dailyReturn,
      annualizedReturn
    })

    return acc
  }, [])

  return stakingReturns
}
