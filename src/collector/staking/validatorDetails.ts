import { filter } from 'lodash'
import { DeepPartial, getRepository } from 'typeorm'

import config from 'config'
import { ValidatorInfoEntity, ValidatorStatus } from 'orm'

import * as lcd from 'lib/lcd'
import { convertAddress, sortDenoms } from 'lib/common'
import { div, plus, times } from 'lib/math'
import { APIError, ErrorTypes } from 'lib/error'
import { SLASHING_PERIOD } from 'lib/constant'
import getAvatar from 'lib/keybase'
import { collectorLogger as logger } from 'lib/logger'
import { getDelegators } from 'service/staking'

const TOKEN_MICRO_UNIT_MULTIPLICAND = '1000000'

function getSelfDelegation(
  delegators: Delegator[],
  accountAddr: string
): {
  amount: string
  weight: string
} {
  const selfDelegations = filter(delegators, ['address', accountAddr])
  return selfDelegations.length > 0
    ? {
        amount: selfDelegations[0].amount,
        weight: selfDelegations[0].weight
      }
    : { amount: '0', weight: '0' }
}

function getUptime(signingInfo: LcdValidatorSigningInfo): number {
  const missedBlocksCounter = +signingInfo.missed_blocks_counter || 0
  return 1 - missedBlocksCounter / SLASHING_PERIOD || 0
}

function getValidatorStatus(validatorInfo: LcdValidator): ValidatorStatus {
  const { status, jailed } = validatorInfo

  if (jailed) {
    return ValidatorStatus.JAILED
  }

  switch (status) {
    case 0: {
      return ValidatorStatus.INACTIVE
    }
    case 1: {
      return ValidatorStatus.UNBONDING
    }
    case 2: {
      return ValidatorStatus.ACTIVE
    }
    default: {
      return ValidatorStatus.UNKNOWN
    }
  }
}

type SaveValidatorParams = {
  lcdValidator: LcdValidator
  activePrices: CoinByDenoms
  votingPower: lcd.LcdVotingPower
}

export async function saveValidatorDetail({ lcdValidator, activePrices, votingPower }: SaveValidatorParams) {
  if (!lcdValidator) {
    throw new APIError(ErrorTypes.VALIDATOR_DOES_NOT_EXISTS)
  }

  const { operator_address: operatorAddress, consensus_pubkey: consensusPubkey } = lcdValidator
  const accountAddr = convertAddress('terra', operatorAddress)
  const { totalVotingPower, votingPowerByPubKey } = votingPower

  const delegators = await getDelegators(operatorAddress).catch(() => [])
  const selfDelegation = getSelfDelegation(delegators, accountAddr)

  const keyBaseId = lcdValidator.description?.identity
  const profileIcon = keyBaseId && (await getAvatar(keyBaseId))

  const missedVote = await lcd.getMissedOracleVotes(operatorAddress)

  const signingInfo = await lcd.getSigningInfo(consensusPubkey).catch(() => ({} as LcdValidatorSigningInfo))

  const lcdRewardPool = await lcd.getValidatorRewards(operatorAddress).catch(() => [] as LcdRewardPoolItem[])

  const upTime = getUptime(signingInfo)
  let rewardPoolTotal = '0'
  const rewardPool = lcdRewardPool
    ? lcdRewardPool.map(({ denom, amount }: LcdRewardPoolItem) => {
        const adjustedAmount: string =
          denom === 'uluna' ? amount : activePrices[denom] ? div(amount, activePrices[denom]) : '0'
        rewardPoolTotal = plus(rewardPoolTotal, adjustedAmount)
        return { denom, amount, adjustedAmount }
      })
    : []

  const { details, identity, moniker, website } = lcdValidator.description
  const validatorDetails: DeepPartial<ValidatorInfoEntity> = {
    chainId: config.CHAIN_ID,
    operatorAddress,
    consensusPubkey,
    accountAddress: accountAddr,
    details,
    identity,
    moniker,
    website,
    tokens: lcdValidator.tokens,
    delegatorShares: lcdValidator.delegator_shares,
    unbondingHeight: +lcdValidator.unbonding_height,
    unbondingTime: new Date(lcdValidator.unbonding_time),
    profileIcon: profileIcon ? profileIcon : '',
    status: getValidatorStatus(lcdValidator),
    jailed: lcdValidator.jailed,
    missedOracleVote: +missedVote,
    upTime,
    votingPower: times(votingPowerByPubKey[consensusPubkey], TOKEN_MICRO_UNIT_MULTIPLICAND),
    votingPowerWeight: div(votingPowerByPubKey[consensusPubkey], totalVotingPower),
    commissionRate: lcdValidator.commission.commission_rates.rate,
    maxCommissionRate: lcdValidator.commission.commission_rates.max_rate,
    maxCommissionChangeRate: lcdValidator.commission.commission_rates.max_change_rate,
    rewardPoolTotal,
    commissionChangeDate: new Date(lcdValidator.commission.update_time),
    selfDelegation: selfDelegation.amount,
    selfDelegationWeight: selfDelegation.weight,
    signingInfo,
    rewardPool: sortDenoms(rewardPool)
  }
  const repo = getRepository(ValidatorInfoEntity)
  const validator = await repo.findOne({ operatorAddress, chainId: config.CHAIN_ID })

  if (!validator) {
    logger.info(`New validator found (operator address: ${operatorAddress}`)
    await repo.save(repo.create(validatorDetails))
  } else {
    logger.info(`Update existing validator (op addr: ${operatorAddress}`)
    await repo.update(validator.id, validatorDetails)
  }
}
