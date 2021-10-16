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

const TOKEN_MICRO_UNIT_MULTIPLICAND = '1000000'

// eslint-disable-next-line
function getBlockUptime(signingInfo: LcdValidatorSigningInfo): number {
  const missedBlocksCounter = +signingInfo.missed_blocks_counter || 0
  return 1 - Math.min(SLASHING_PERIOD, missedBlocksCounter) / SLASHING_PERIOD
}

function getOracleUptime(missedOracleVote): number {
  return 1 - Math.min(config.ORACLE_SLASH_WINDOW, missedOracleVote) / config.ORACLE_SLASH_WINDOW
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
  votingPower: lcd.VotingPower
}

export async function saveValidatorDetail({ lcdValidator, activePrices, votingPower }: SaveValidatorParams) {
  if (!lcdValidator) {
    throw new Error('lcdValidator is nil')
  }

  const { operator_address: operatorAddress, consensus_pubkey: consensusPubkey } = lcdValidator
  const accountAddr = convertAddress('terra', operatorAddress)
  const { totalVotingPower, votingPowerByPubKey } = votingPower

  const selfDelegation = await lcd.getDelegationForValidator(accountAddr, operatorAddress)
  const keyBaseId = lcdValidator.description?.identity
  const profileIcon = keyBaseId && (await getAvatar(keyBaseId))

  const missedOracleVote = +(await lcd.getMissedOracleVotes(operatorAddress))

  const signingInfo = await lcd.getSigningInfo(consensusPubkey).catch(() => ({} as LcdValidatorSigningInfo))

  const lcdRewardPool = await lcd.getValidatorRewards(operatorAddress).catch(() => [] as Coin[])

  let rewardPoolTotal = '0'
  const rewardPool = lcdRewardPool
    ? lcdRewardPool.map(({ denom, amount }: Coin) => {
        const adjustedAmount: string =
          denom === 'uluna' ? amount : activePrices[denom] ? div(amount, activePrices[denom]) : '0'
        rewardPoolTotal = plus(rewardPoolTotal, adjustedAmount)
        return { denom, amount, adjustedAmount }
      })
    : []

  const { details, identity, moniker, website } = lcdValidator.description
  const validatorDetails: DeepPartial<ValidatorInfoEntity> = {
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
    missedOracleVote,
    upTime: getOracleUptime(missedOracleVote) * getBlockUptime(signingInfo),
    votingPower: times(votingPowerByPubKey[consensusPubkey], TOKEN_MICRO_UNIT_MULTIPLICAND),
    votingPowerWeight: div(votingPowerByPubKey[consensusPubkey], totalVotingPower),
    commissionRate: lcdValidator.commission.commission_rates.rate,
    maxCommissionRate: lcdValidator.commission.commission_rates.max_rate,
    maxCommissionChangeRate: lcdValidator.commission.commission_rates.max_change_rate,
    rewardPoolTotal,
    commissionChangeDate: new Date(lcdValidator.commission.update_time),
    selfDelegation: selfDelegation?.balance.amount ?? '0.0',
    selfDelegationWeight: div(selfDelegation?.shares ?? '0.0', lcdValidator.delegator_shares),
    signingInfo,
    rewardPool: sortDenoms(rewardPool)
  }

  const repo = getRepository(ValidatorInfoEntity)
  const validator = await repo.findOne({ operatorAddress })

  if (!validator) {
    logger.info(`collectValidator: ${moniker}(${operatorAddress})(new)`)
    await repo.save(repo.create(validatorDetails))
  } else {
    logger.info(`collectValidator: ${moniker}(${operatorAddress})`)
    await repo.update(validator.id, validatorDetails)
  }
}
