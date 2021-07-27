import { get, orderBy } from 'lodash'
import { getRepository, Brackets, WhereExpression, getConnection } from 'typeorm'
import { startOfDay } from 'date-fns'

import config from 'config'
import { TxEntity, ValidatorInfoEntity } from 'orm'

import * as lcd from 'lib/lcd'
import { SLASHING_PERIOD } from 'lib/constant'
import { div, plus, minus, times } from 'lib/math'
import { getQueryDateTime } from 'lib/time'
import memoizeCache from 'lib/memoizeCache'

import getDelegationTxs from './getDelegationTxs'
import { ValidatorAnnualReturn } from './getValidatorReturn'

enum ValidatorStatusType {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  JAILED = 'jailed',
  UNBONDING = 'unbonding',
  UNKNOWN = 'unknown'
}

interface GetRawDelegationTxsParam {
  operatorAddr: string
  limit?: number
  offset?: number
}

export function getUptime(signingInfo: LcdValidatorSigningInfo): number {
  const missedBlocksCounter = get(signingInfo, 'missed_blocks_counter')
  return 1 - Number(missedBlocksCounter) / SLASHING_PERIOD || 0
}

export function getValidatorStatus(validatorInfo: LcdValidator): ValidatorStatusType {
  const { status, jailed } = validatorInfo

  if (jailed) {
    return ValidatorStatusType.JAILED
  }

  switch (status) {
    case 0: {
      return ValidatorStatusType.INACTIVE
    }

    case 1: {
      return ValidatorStatusType.UNBONDING
    }

    case 2: {
      return ValidatorStatusType.ACTIVE
    }

    default: {
      return ValidatorStatusType.UNKNOWN
    }
  }
}

function addDelegateFilterToQuery(qb: WhereExpression, operatorAddress: string) {
  qb.andWhere(
    new Brackets((q) => {
      q.andWhere(
        new Brackets((qinner) => {
          qinner
            .where(`data->'code' IS NULL`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgDelegate"}]'`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
        })
      )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .where(`data->'code' IS NULL`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgCreateValidator"}]'`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
          })
        )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .where(`data->'code' IS NULL`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgBeginRedelegate"}]'`)
              .andWhere(
                `data->'tx'->'value'->'msg'@>'[{ "value": { "validator_src_address": "${operatorAddress}" } }]'`
              )
          })
        )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .where(`data->'code' IS NULL`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgBeginRedelegate"}]'`)
              .andWhere(
                `data->'tx'->'value'->'msg'@>'[{ "value": { "validator_dst_address": "${operatorAddress}" } }]'`
              )
          })
        )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .where(`data->'code' IS NULL`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgUndelegate"}]'`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
          })
        )
    })
  )
}

export async function getRawDelegationTxs(param: GetRawDelegationTxsParam): Promise<{
  txs: (Transaction.LcdTransaction & { id: number; chainId: string })[]
  next?: number
}> {
  const qb = getRepository(TxEntity)
    .createQueryBuilder('tx')
    .select(['tx.id', 'tx.chainId', 'tx.data'])
    .orderBy('timestamp', 'DESC')

  if (param.limit) {
    qb.take(param.limit + 1)
  }

  if (param.offset) {
    qb.where(`id < :offset`, { offset: param.offset })
  }

  addDelegateFilterToQuery(qb, param.operatorAddr)

  const txs = await qb.getMany()
  let next

  // we have next result
  if (param.limit && param.limit + 1 === txs.length) {
    next = txs[param.limit - 1].id
    txs.length -= 1
  }

  return {
    next,
    txs: txs.map((tx) => ({ ...tx.data, id: tx.id, chainId: tx.chainId }))
  }
}

export async function getCommissions(operatorAddr: string): Promise<Coin[]> {
  try {
    const totalRewards = await lcd.getCommissions(operatorAddr)
    return totalRewards ? totalRewards.val_commission.commission : []
  } catch (e) {
    return []
  }
}

export function getUndelegateSchedule(
  unbondings: LcdStakingUnbonding[],
  validatorObj: { [validatorAddress: string]: ValidatorResponse }
): UndeligationSchedule[] {
  return orderBy(
    unbondings
      .map((unbonding: LcdStakingUnbonding) => {
        const { validator_address, entries } = unbonding
        const validatorName: string = get(validatorObj, `${validator_address}`).description.moniker
        const validatorStatus: string = get(validatorObj, `${validator_address}`).status
        return entries.map((entry: LcdStakingEntry) => {
          return {
            releaseTime: entry.completion_time,
            amount: entry.balance,
            validatorName,
            validatorAddress: validator_address,
            validatorStatus,
            creationHeight: entry.creation_height
          }
        })
      })
      .flat(),
    ['releaseTime'],
    ['asc']
  )
}

export async function getAvgVotingPowerUncached(
  validator: LcdValidator,
  fromTs: number,
  toTs: number,
  votingPowerNow: string
): Promise<string | undefined> {
  const { events } = await getDelegationTxs({ operatorAddr: validator.operator_address })

  const fromStr = new Date(fromTs).toISOString()
  const delegationBetweenRange = events.filter((ev) => {
    const time = new Date(ev.timestamp).getTime()
    return time >= fromTs && time < toTs
  })
  const delegationEventsAfterToday = events.filter((ev) => new Date(ev.timestamp).getTime() >= toTs)

  const getWeightedVotingPower = (votingPowerNow) => {
    const votingPowerAtEndTime = delegationEventsAfterToday.reduce((acc, event) => {
      const eventAmount = get(event, 'amount.amount')

      if (!eventAmount) {
        return acc
      }

      return minus(acc, eventAmount)
    }, votingPowerNow)

    const tsRange = toTs - fromTs

    if (delegationBetweenRange.length === 0) {
      return votingPowerAtEndTime
    }

    delegationBetweenRange.push({
      id: 0,
      chainId: config.CHAIN_ID,
      txhash: '',
      height: '', // TODO: remove
      type: 'Delegate',
      amount: { denom: 'uluna', amount: '0' },
      timestamp: fromStr
    })

    const weightedSumObj = delegationBetweenRange.reduce(
      (acc, item) => {
        const tsDelta = acc.prevTs - new Date(item.timestamp).getTime()
        const weight = tsDelta / tsRange
        const amountDelta = get(item, 'amount.amount')

        if (!amountDelta) {
          return acc
        }

        const weightedSum = plus(acc.weightedSum, times(weight, acc.prevAmount))

        return {
          prevAmount: minus(acc.prevAmount, amountDelta),
          prevTs: new Date(item.timestamp).getTime(),
          weightedSum
        }
      },
      { prevAmount: votingPowerAtEndTime, weightedSum: '0', prevTs: toTs }
    )

    return weightedSumObj.weightedSum
  }

  return getWeightedVotingPower(votingPowerNow)
}

export const getAvgVotingPower = memoizeCache(getAvgVotingPowerUncached, { promise: true, maxAge: 60 * 60 * 1000 })

export async function getAvgPrice(fromTs: number, toTs: number): Promise<DenomMap> {
  const fromStr = getQueryDateTime(startOfDay(fromTs))
  const toStr = getQueryDateTime(startOfDay(toTs))

  const query = `
SELECT denom,
  AVG(price) AS avg_price
FROM price
WHERE datetime >= '${fromStr}'
AND datetime < '${toStr}'
GROUP BY denom`

  const prices = await getConnection().query(query)
  return prices.reduce((acc, item) => {
    acc[item.denom] = item.avg_price
    return acc
  }, {})
}

export async function getTotalStakingReturnUncached(fromTs: number, toTs: number): Promise<string> {
  const toStr = getQueryDateTime(toTs)
  const fromStr = getQueryDateTime(fromTs)
  const rewardQuery = `
SELECT denom,
  SUM(sum) AS reward_sum
FROM reward
WHERE datetime >= '${fromStr}'
AND datetime < '${toStr}'
GROUP BY denom
`
  const rewards = await getConnection().query(rewardQuery)
  const avgPrice = await getAvgPrice(fromTs, toTs)

  const bondedTokensQuery = `
SELECT avg(bonded_tokens) AS avg_bonded_tokens
FROM general_info
WHERE datetime >= '${fromStr}'
  AND datetime < '${toStr}'`

  const bondedTokens = await getConnection().query(bondedTokensQuery)

  if (rewards.length === 0 || bondedTokens.length === 0) {
    return '0'
  }

  const staked = bondedTokens[0].avg_bonded_tokens
  const rewardSum = rewards.reduce((acc, reward) => {
    if (!reward.reward_sum) {
      return acc
    }

    const rewardSum = reward.denom === 'uluna' ? reward.reward_sum : div(reward.reward_sum, avgPrice[reward.denom])

    return plus(acc, rewardSum)
  }, '0')
  const netReturn = div(rewardSum, staked)
  const annualizedTimeSlot = div(365 * 24 * 3600 * 1000, toTs - fromTs)
  const annualizedReturn = times(netReturn, annualizedTimeSlot)
  return annualizedReturn
}

export const getTotalStakingReturn = memoizeCache(getTotalStakingReturnUncached, {
  promise: true,
  maxAge: 60 * 60 * 1000
})

export function generateValidatorResponse(validator: ValidatorInfoEntity): ValidatorResponse {
  const {
    operatorAddress,
    tokens,
    delegatorShares,
    upTime,
    status,
    accountAddress,
    identity,
    moniker,
    website,
    securityContact,
    details,
    profileIcon,
    votingPower,
    votingPowerWeight,
    commissionRate,
    maxCommissionRate,
    maxCommissionChangeRate,
    commissionChangeDate,
    rewardPool,
    rewardPoolTotal,
    selfDelegation,
    selfDelegationWeight
  } = validator

  return {
    operatorAddress,
    tokens,
    delegatorShares,
    upTime,
    status,
    accountAddress,
    description: {
      identity,
      moniker,
      website,
      securityContact,
      details,
      profileIcon
    },
    votingPower: {
      amount: votingPower,
      weight: votingPowerWeight
    },
    commissionInfo: {
      rate: commissionRate,
      maxRate: maxCommissionRate,
      maxChangeRate: maxCommissionChangeRate,
      updateTime: commissionChangeDate.toJSON()
    },
    rewardsPool: {
      total: rewardPoolTotal,
      denoms: rewardPool
    },
    selfDelegation: {
      amount: selfDelegation,
      weight: selfDelegationWeight
    }
  }
}
