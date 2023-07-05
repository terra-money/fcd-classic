import { getConnection } from 'typeorm'

import config from 'config'

import { getQueryDateTime } from 'lib/time'
import { plus, div, getIntegerPortion } from 'lib/math'
import { BOND_DENOM } from 'lib/constant'

const REWARD_SUM = `reward_sum`
const COMMISSION_SUM = `commission_sum`

function rewardSumQuery(operatorAddr: string, denom: string): string {
  return `COALESCE(sum (COALESCE((reward_per_val->'${operatorAddr}'->>'${denom}')::float, 0)), 0) as ${denom}_${REWARD_SUM}`
}

function commissionSumQuery(operatorAddr: string, denom: string): string {
  return `COALESCE(sum (COALESCE((commission_per_val->'${operatorAddr}'->>'${denom}')::float, 0)), 0) as ${denom}_${COMMISSION_SUM}`
}

function getSelectSumQueryForDenoms(operatorAddr: string): string {
  return config.ACTIVE_DENOMS.map((denom: string): string => {
    return `${rewardSumQuery(operatorAddr, denom)}, ${commissionSumQuery(operatorAddr, denom)}`
  }).join(',')
}

function getTimeRangeQuery(fromTs: number, toTs: number): string {
  return `timestamp >= '${getQueryDateTime(fromTs)}' and timestamp < '${getQueryDateTime(toTs)}'`
}

type RewardAndCommissionObj = {
  reward: DenomMap
  commission: DenomMap
}

export async function getValidatorRewardAndCommissionSum(
  operatorAddr: string,
  fromTs: number,
  toTs: number
): Promise<RewardAndCommissionObj> {
  const query = `SELECT ${getSelectSumQueryForDenoms(
    operatorAddr
  )} FROM blockreward r, block b WHERE r.block_id=b.id AND ${getTimeRangeQuery(fromTs, toTs)}`

  const result = await getConnection().query(query)

  const sum = config.ACTIVE_DENOMS.reduce(
    (acc: RewardAndCommissionObj, denom: string) => {
      acc.reward[denom] = result[0][`${denom}_${REWARD_SUM}`]
      acc.commission[denom] = result[0][`${denom}_${COMMISSION_SUM}`]
      return acc
    },
    { reward: {}, commission: {} } as RewardAndCommissionObj
  )
  return sum
}

export function normalizeRewardAndCommissionToLuna(
  rewardAndCommission: RewardAndCommissionObj,
  avgPriceObj: DenomMap
): {
  reward: string
  commission: string
} {
  const { reward, commission } = rewardAndCommission
  const rewardsInLuna = Object.keys(reward).reduce(
    (sum: string, denom: string) =>
      plus(sum, denom === BOND_DENOM ? reward[denom] : div(reward[denom], avgPriceObj[denom])),
    '0'
  )

  const commissionInLuna = Object.keys(commission).reduce(
    (sum: string, denom: string) =>
      plus(sum, denom === BOND_DENOM ? commission[denom] : div(commission[denom], avgPriceObj[denom])),
    '0'
  )

  return {
    reward: getIntegerPortion(rewardsInLuna),
    commission: getIntegerPortion(commissionInLuna)
  }
}
