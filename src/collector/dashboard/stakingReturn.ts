import { getRepository } from 'typeorm'
import { subDays } from 'date-fns'

import * as lcd from 'lib/lcd'
import { times, div, plus } from 'lib/math'
import { getDateFromDateTime } from 'lib/time'

import { GeneralInfoEntity } from 'orm'

import { convertDbTimestampToDate, getPriceObjKey, getLatestDateOfGeneralInfo } from './helpers'
import { getRewardsSumByDateDenom } from './rewardsInfo'
import { getPriceHistory } from 'service/dashboard'
import { BOND_DENOM } from 'lib/constant'

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

async function getAvgBondedTokensByDate(daysBefore?: number): Promise<{
  [date: string]: string
}> {
  const latestDate = await getLatestDateOfGeneralInfo()
  const issuance = (await lcd.getTotalSupply()).find((e) => e.denom === BOND_DENOM)?.amount || '0'
  const stakingQb = getRepository(GeneralInfoEntity)
    .createQueryBuilder()
    .select(convertDbTimestampToDate('datetime'), 'date')
    .addSelect('AVG(staking_ratio)', 'avg_staking_ratio')
    .addSelect('AVG(bonded_tokens)', 'avg_bonded_tokens')
    .groupBy('date')
    .orderBy('date', 'DESC')
    .where('datetime < :today', { today: latestDate })

  if (daysBefore) {
    stakingQb.andWhere('datetime >= :from', { from: subDays(latestDate, daysBefore) })
  }

  const bondedTokens = await stakingQb.getRawMany()

  const bondedTokensObj = bondedTokens.reduce((acc, item) => {
    acc[item.date] = item.avg_bonded_tokens ? item.avg_bonded_tokens : times(issuance, item.avg_staking_ratio)
    return acc
  }, {})
  return bondedTokensObj
}

async function getRewardsInLunaByDate(daysBefore?: number): Promise<{
  [date: string]: DailyReturnInfo
}> {
  const rewards = await getRewardsSumByDateDenom(daysBefore)
  const priceObj = await getPriceHistory(daysBefore)

  const rewardObj: {
    [date: string]: DailyReturnInfo
  } = rewards.reduce((acc, item) => {
    if (!priceObj[getPriceObjKey(item.date, item.denom)] && item.denom !== BOND_DENOM) {
      return acc
    }

    const tax =
      item.denom === BOND_DENOM ? item.tax_sum : div(item.tax_sum, priceObj[getPriceObjKey(item.date, item.denom)])
    const gas =
      item.denom === BOND_DENOM ? item.gas_sum : div(item.gas_sum, priceObj[getPriceObjKey(item.date, item.denom)])
    const oracle =
      item.denom === BOND_DENOM
        ? item.oracle_sum
        : div(item.oracle_sum, priceObj[getPriceObjKey(item.date, item.denom)])
    const commission =
      item.denom === BOND_DENOM
        ? item.commission_sum
        : div(item.commission_sum, priceObj[getPriceObjKey(item.date, item.denom)])
    const reward =
      item.denom === BOND_DENOM
        ? item.reward_sum
        : div(item.reward_sum, priceObj[getPriceObjKey(item.date, item.denom)])

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
  return rewardObj
}

export async function getStakingReturnByDay(daysBefore?: number): Promise<{ [date: string]: DailyStakingInfo }> {
  const bondedTokensObj = await getAvgBondedTokensByDate(daysBefore)
  const rewardObj = await getRewardsInLunaByDate(daysBefore)

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
    acc[getDateFromDateTime(new Date(date))] = {
      reward: rewardSum,
      avgStaking: staked
    }
    return acc
  }, {})
  return stakingReturns
}
