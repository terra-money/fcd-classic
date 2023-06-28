import { DeepPartial, getRepository } from 'typeorm'

import config from 'config'
import { ValidatorInfoEntity, ValidatorStatus } from 'orm'

import * as lcd from 'lib/lcd'
import { convertAddress, sortDenoms } from 'lib/common'
import { div, plus } from 'lib/math'
import { SLASHING_PERIOD } from 'lib/constant'
import getAvatar from 'lib/keybase'
import { collectorLogger as logger } from 'lib/logger'

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
    case 'BOND_STATUS_UNBONDED': {
      return ValidatorStatus.INACTIVE
    }
    case 'BOND_STATUS_UNBONDING': {
      return ValidatorStatus.UNBONDING
    }
    case 'BOND_STATUS_BONDED': {
      return ValidatorStatus.ACTIVE
    }
    default: {
      return ValidatorStatus.UNKNOWN
    }
  }
}

export async function saveValidatorDetail(extendedValidator: lcd.ExtendedValidator, activePrices: DenomMap) {
  const { lcdValidator } = extendedValidator
  const operatorAddress = lcdValidator.operator_address
  const { details, identity, moniker, website, security_contact: securityContact } = lcdValidator.description
  const accountAddr = convertAddress('terra', operatorAddress)

  const selfDelegation = await lcd.getDelegationForValidator(accountAddr, operatorAddress)
  const profileIcon = identity && (await getAvatar(identity))
  const missedOracleVote = +(await lcd.getMissedOracleVotes(operatorAddress))
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

  const validatorDetails: DeepPartial<ValidatorInfoEntity> = {
    operatorAddress,
    accountAddress: accountAddr,
    details: details || '',
    identity: identity || '',
    moniker: moniker || '',
    website: website || '',
    securityContact: securityContact || '',
    tokens: lcdValidator.tokens,
    delegatorShares: lcdValidator.delegator_shares,
    unbondingHeight: +lcdValidator.unbonding_height || 0,
    unbondingTime: new Date(lcdValidator.unbonding_time),
    profileIcon: profileIcon ? profileIcon : '',
    status: getValidatorStatus(lcdValidator),
    jailed: lcdValidator.jailed,
    missedOracleVote,
    upTime: getOracleUptime(missedOracleVote),
    votingPower: extendedValidator.votingPower,
    votingPowerWeight: extendedValidator.votingPowerWeight,
    commissionRate: lcdValidator.commission.commission_rates.rate,
    maxCommissionRate: lcdValidator.commission.commission_rates.max_rate,
    maxCommissionChangeRate: lcdValidator.commission.commission_rates.max_change_rate,
    rewardPoolTotal,
    commissionChangeDate: new Date(lcdValidator.commission.update_time),
    selfDelegation: selfDelegation?.balance.amount ?? '0.0',
    selfDelegationWeight: div(selfDelegation?.delegation.shares ?? '0.0', lcdValidator.delegator_shares),
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
