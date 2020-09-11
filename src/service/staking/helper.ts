import { get, orderBy, flatten } from 'lodash'
import { getRepository, Brackets, WhereExpression, getConnection } from 'typeorm'
import { startOfDay } from 'date-fns'

import { TxEntity, ValidatorInfoEntity } from 'orm'

import { APIError, ErrorTypes } from 'lib/error'
import * as lcd from 'lib/lcd'
import { SLASHING_PERIOD } from 'lib/constant'
import { div, plus, minus, times } from 'lib/math'
import { convertValAddressToAccAddress, sortDenoms } from 'lib/common'
import getAvatar from 'lib/keybase'
import { getQueryDateTime } from 'lib/time'
import memoizeCache from 'lib/memoizeCache'

import getDelegationTxs from './getDelegationTxs'
import { GetClaimsParam } from './getClaims'
import { getValidatorAnnualAvgReturn } from './getValidatorReturn'

enum ValidatorStatusType {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  JAILED = 'jailed',
  UNBONDING = 'unbonding',
  UNKNOWN = 'unknown'
}

interface GetValidatorParam {
  validatorInfo: LcdValidator
  totalVotingPower: string
  votingPowerObj: { [key: string]: string }
  priceObj: { [key: string]: string }
}

interface GetValidatorReturn {
  consensusPubkey: string
  operatorAddress: string
  tokens: string
  delegatorShares: string
  description: LcdValidatorDescription
  votingPower: { [key: string]: string }
  commissionInfo: ValidatorCommission
  upTime: number
  status: string
  rewardsPool: any
  stakingReturn?: string
  isNewValidator?: boolean
}

interface GetRawDelegationTxsParam {
  operatorAddr: string
  from?: string
  to?: string
  page: number
  limit: number
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

function commissionMapper(item: LcdValidatorCommission): ValidatorCommission {
  return {
    rate: item.commission_rates.rate,
    maxRate: item.commission_rates.max_rate,
    maxChangeRate: item.commission_rates.max_change_rate,
    updateTime: item.update_time
  }
}

export async function getValidator(param: GetValidatorParam): Promise<GetValidatorReturn | undefined> {
  const { validatorInfo, totalVotingPower, votingPowerObj, priceObj } = param
  const { consensus_pubkey, operator_address, delegator_shares, tokens } = validatorInfo
  const keyBaseId = get(validatorInfo, 'description.identity')
  const profileIcon = keyBaseId && (await getAvatar(keyBaseId))
  const description = {
    ...validatorInfo.description,
    profileIcon
  }

  const { stakingReturn, isNewValidator } = await getValidatorAnnualAvgReturn(operator_address)

  const signingInfo = await lcd.getSigningInfo(consensus_pubkey)

  if (!signingInfo) {
    return
  }

  const lcdRewardPool = await lcd.getValidatorRewards(operator_address)

  if (!Array.isArray(lcdRewardPool)) {
    return
  }

  const upTime = getUptime(signingInfo)

  let rewardPoolTotal = '0'
  const rewardPool = lcdRewardPool.map(({ denom, amount }: LcdRewardPoolItem) => {
    const adjustedAmount = denom === 'uluna' ? amount : priceObj[denom] ? div(amount, priceObj[denom]) : 0
    rewardPoolTotal = plus(rewardPoolTotal, adjustedAmount)
    return { denom, amount, adjustedAmount }
  })
  const validatorStatus = getValidatorStatus(validatorInfo)

  return {
    operatorAddress: operator_address,
    consensusPubkey: consensus_pubkey,
    description,
    tokens,
    delegatorShares: delegator_shares,
    votingPower: {
      amount: times(votingPowerObj[consensus_pubkey], '1000000'),
      weight: div(votingPowerObj[consensus_pubkey], totalVotingPower)
    },
    commissionInfo: commissionMapper(validatorInfo.commission),
    upTime,
    status: validatorStatus,
    rewardsPool: {
      total: rewardPoolTotal,
      denoms: sortDenoms(rewardPool)
    },
    stakingReturn,
    isNewValidator
  }
}

export async function getDelegators(opertorAddress: string): Promise<Delegator[]> {
  const lcdDelegators = await lcd.getValidatorDelegations(opertorAddress)

  if (!lcdDelegators) {
    return []
  }

  const delegateTotal = lcdDelegators.reduce((acc, curr) => {
    return plus(acc, curr.shares)
  }, '0')

  const delegators: Delegator[] = lcdDelegators.map((delegator) => {
    return {
      address: delegator.delegator_address,
      amount: delegator.shares,
      weight: div(delegator.shares, delegateTotal)
    }
  })

  return orderBy(delegators, [(d) => Number(d.weight)], ['desc'])
}

function addDelegateFilterToQuery(qb: WhereExpression, operatorAddress: string) {
  qb.andWhere(
    new Brackets((q) => {
      q.andWhere(
        new Brackets((qinner) => {
          qinner
            .where(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgDelegate"}]'`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
        })
      )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgCreateValidator"}]'`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
          })
        )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgBeginRedelegate"}]'`)
              .andWhere(
                `data->'tx'->'value'->'msg'@>'[{ "value": { "validator_src_address": "${operatorAddress}" } }]'`
              )
          })
        )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgBeginRedelegate"}]'`)
              .andWhere(
                `data->'tx'->'value'->'msg'@>'[{ "value": { "validator_dst_address": "${operatorAddress}" } }]'`
              )
          })
        )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgUndelegate"}]'`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
          })
        )
    })
  )
}

export async function getRawDelegationTxs(data: GetRawDelegationTxsParam) {
  const offset = (data.page - 1) * data.limit

  const qb = getRepository(TxEntity).createQueryBuilder('tx').select('tx.data')
  addDelegateFilterToQuery(qb, data.operatorAddr)

  data.from && qb.andWhere(`timestamp >= '${data.from}'`)
  data.to && qb.andWhere(`timestamp < '${data.to}'`)

  qb.skip(offset).take(data.limit).orderBy('timestamp', 'DESC')
  const [txs, totalCnt] = await qb.getManyAndCount()

  return {
    totalCnt,
    txs: txs.map((tx) => tx.data)
  }
}

function addClaimFilterToQuery(qb: WhereExpression, operatorAddress: string, accountAddress: string) {
  qb.andWhere(
    new Brackets((q) => {
      q.andWhere(
        new Brackets((qinner) => {
          qinner
            .where(`data->'tx'->'value'->'msg'@>'[{ "type": "distribution/MsgWithdrawValidatorCommission"}]'`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
        })
      ).orWhere(
        new Brackets((qinner) => {
          qinner
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "distribution/MsgWithdrawDelegationReward"}]'`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "delegator_address": "${accountAddress}" } }]'`)
        })
      )
    })
  )
}

interface ClaimTxList {
  totalCnt: number // number of total Claim txs
  txs: TxEntity[] // claims tx list
}

export async function getClaimTxs(data: GetClaimsParam): Promise<ClaimTxList> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx').select('tx.data')

  const accountAddr = convertValAddressToAccAddress(data.operatorAddr)
  addClaimFilterToQuery(qb, data.operatorAddr, accountAddr)

  const totalCnt = await qb.getCount()

  qb.skip(data.limit * (data.page - 1))
    .take(data.limit)
    .orderBy('timestamp', 'DESC')
  const txs = await qb.getMany()
  return { totalCnt, txs }
}

export async function getCommissions(operatorAddr: string): Promise<Coin[]> {
  try {
    const totalRewards = await lcd.getCommissions(operatorAddr)
    return totalRewards ? totalRewards.val_commission : []
  } catch (e) {
    return []
  }
}

export async function getMyDelegation(delegator: string, validator: ValidatorResponse): Promise<string | undefined> {
  const delegation = await lcd.getDelegationForValidator(delegator, validator.operatorAddress)
  return delegation?.shares && div(times(delegation.shares, validator.tokens), validator.delegatorShares)
}

export function getUndelegateSchedule(
  unbondings: LcdUnbonding[],
  validatorObj: { [validatorAddress: string]: ValidatorResponse }
): UndeligationSchedule[] {
  return orderBy(
    flatten(
      unbondings.map((unbonding: LcdUnbonding) => {
        const { validator_address, entries } = unbonding
        const validatorName: string = get(validatorObj, `${validator_address}`).description.moniker
        const validatorStatus: string = get(validatorObj, `${validator_address}`).status
        return entries.map((entry: LcdUnbondingEntry) => {
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
    ),
    ['releaseTime'],
    ['asc']
  )
}

export async function getAvgVotingPowerUncached(
  operatorAddr: string,
  fromTs: number,
  toTs: number
): Promise<string | undefined> {
  const validator = await lcd.getValidator(operatorAddr)

  if (!validator) {
    throw new APIError(ErrorTypes.VALIDATOR_DOES_NOT_EXISTS)
  }

  const votingPowerInfo = await lcd.getValidatorVotingPower(validator.consensus_pubkey)

  if (!votingPowerInfo) {
    return
  }

  const { voting_power: votingPowerNow } = votingPowerInfo

  const fromStr = getQueryDateTime(fromTs)
  const toStr = getQueryDateTime(toTs)

  const { events: delegationBetweenRange } = await getDelegationTxs({
    operatorAddr,
    from: fromStr,
    to: toStr,
    page: 1,
    limit: 1000
  })

  const { events: delegationEventsAfterToday } = await getDelegationTxs({
    operatorAddr,
    from: toStr,
    page: 1,
    limit: 1000
  })

  const getWeightedVotingPower = (votingPowerNow) => {
    const votingPowerAtEndTime = delegationEventsAfterToday.reduce((acc, event) => {
      const eventAmount = get(event, 'amount.amount')

      if (!eventAmount) {
        return acc
      }

      return minus(acc, eventAmount)
    }, times(votingPowerNow, 1000000))

    const tsRange = toTs - fromTs

    if (delegationBetweenRange.length === 0) {
      return votingPowerAtEndTime
    }

    delegationBetweenRange.push({
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

export function generateValidatorResponse(
  validator: ValidatorInfoEntity,
  { stakingReturn, isNewValidator }: ValidatorAnnualReturn
): ValidatorResponse {
  const {
    operatorAddress,
    consensusPubkey,
    tokens,
    delegatorShares,
    upTime,
    status,
    accountAddress,
    identity,
    moniker,
    website,
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
    consensusPubkey,
    tokens,
    delegatorShares,
    upTime,
    status,
    accountAddress,
    description: {
      identity,
      moniker,
      website,
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
    },
    stakingReturn,
    isNewValidator
  }
}
