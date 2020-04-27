import config from 'config'
import { mergeWith } from 'lodash'
import { BlockRewardEntity } from 'orm'
import { getRepository, getConnection } from 'typeorm'
import { div, plus, minus, times } from 'lib/math'
import { getAvgPrice } from './helper'
import { getQueryDateTime } from 'lib/time'

interface BlockReward {
  reward_per_val: object
  commission_per_val: object
  height: number
  timestamp: Date
}

export async function getBlockRewards(fromTs: number, toTs: number): Promise<BlockReward[]> {
  const fromStr = getQueryDateTime(fromTs)
  const toStr = getQueryDateTime(toTs)

  const query = `SELECT * FROM blockreward WHERE timestamp >= '${fromStr}' AND timestamp < '${toStr}' AND chain_id='${config.CHAIN_ID}' AND block_id IS NOT NULL`

  const blockrewards = await getConnection().query(query)

  // TO FIX: if blockrewards.lengt == 0 blockrewards[blockrewards.length - 1].height won't work.

  if (blockrewards.length > 0) {
    const lastBlockreward = await getRepository(BlockRewardEntity).findOne({
      chainId: config.CHAIN_ID,
      height: blockrewards[blockrewards.length - 1].height
    })

    if (lastBlockreward) {
      blockrewards.push({
        reward_per_val: lastBlockreward.rewardPerVal,
        commission_per_val: lastBlockreward.commissionPerVal,
        height: lastBlockreward.height,
        timestamp: lastBlockreward.timestamp
      })
    }
    blockrewards.shift()
  }
  return blockrewards
}

export default async function getValidatorReturn(
  operatorAddress: string,
  votingPower: string,
  fromTs: number,
  toTs: number,
  blockRewardsInput?
): Promise<string> {
  const blockRewards = blockRewardsInput ? blockRewardsInput : await getBlockRewards(fromTs, toTs)
  const priceObj = await getAvgPrice(fromTs, toTs)
  const rewardMerger = (obj: object, src: object): object => {
    return mergeWith(obj, src, (o, s) => {
      return plus(o, s)
    })
  }

  const { reward: rewardObj, commission: commissionObj } = blockRewards.reduce(
    (acc, block) => {
      const reward = block.reward_per_val[operatorAddress] || {}
      const commission = block.commission_per_val[operatorAddress] || {}
      return mergeWith(acc, { ...{ reward }, commission }, rewardMerger)
    },
    { reward: {}, commission: {} }
  )

  const reward = Object.keys(rewardObj).reduce((acc, denom) => {
    const amountConvertedLuna = denom === 'uluna' ? rewardObj[denom] : div(rewardObj[denom], priceObj[denom])
    return plus(acc, amountConvertedLuna)
  }, '0')

  const commission = Object.keys(commissionObj).reduce((acc, denom) => {
    const amountConvertedLuna = denom === 'uluna' ? commissionObj[denom] : div(commissionObj[denom], priceObj[denom])
    return plus(acc, amountConvertedLuna)
  }, '0')

  const rewardNet = minus(reward, commission)
  return rewardNet === '0' ? '0' : times(div(rewardNet, votingPower), 365) || '0'
}

export async function getValidatorAnnualAvgReturn(operatorAddress: string): Promise<ValidatorAnnualReturn> {
  const rawQuery = `select operator_address,
    sum((reward - commission)/(avg_voting_power)) * 365 / count(*) as annual_return, count(*) as data_point_count from validator_return_info
    where timestamp >= DATE(now() - Interval '30 day') and operator_address = '${operatorAddress}' and avg_voting_power > 0 group by operator_address`

  const validatorReturn = await getConnection().query(rawQuery)

  if (validatorReturn.length < 1) {
    return {
      stakingReturn: '0',
      isNewValidator: true
    }
  }
  return {
    stakingReturn: validatorReturn[0].annual_return,
    isNewValidator: validatorReturn[0].data_point_count > 15 ? false : true
  }
}
