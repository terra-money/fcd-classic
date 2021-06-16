import { DeepPartial, getRepository } from 'typeorm'

import config from 'config'
import { ValidatorInfoEntity, ValidatorStatus } from 'orm'

import * as lcd from 'lib/lcd'
import { convertAddress, sortDenoms } from 'lib/common'
import { div, plus } from 'lib/math'
import { SLASHING_PERIOD } from 'lib/constant'
import getAvatar from 'lib/keybase'
import { collectorLogger as logger } from 'lib/logger'

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
    case 1: {
      return ValidatorStatus.INACTIVE
    }
    case 2: {
      return ValidatorStatus.UNBONDING
    }
    case 3: {
      return ValidatorStatus.ACTIVE
    }
    default: {
      return ValidatorStatus.UNKNOWN
    }
  }
}

export async function saveValidatorDetail(extendedValidator: lcd.ExtendedValidator, activePrices: CoinByDenoms) {
  const { lcdValidator, signingInfo } = extendedValidator
  const operatorAddress = lcdValidator.operator_address

  logger.info(`Updating validator ${lcdValidator.description.moniker} ${operatorAddress}`)

  const accountAddr = convertAddress('terra', operatorAddress)

  const selfDelegation = await lcd.getDelegationForValidator(accountAddr, operatorAddress)
  const { details, identity, moniker, website, security_contact: securityContact } = lcdValidator.description
  const profileIcon = identity && (await getAvatar(identity))
  const missedVote = await lcd.getMissedOracleVotes(operatorAddress)
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
    details,
    identity,
    moniker,
    website,
    securityContact,
    tokens: lcdValidator.tokens,
    delegatorShares: lcdValidator.delegator_shares,
    unbondingHeight: +lcdValidator.unbonding_height || 0,
    unbondingTime: new Date(lcdValidator.unbonding_time),
    profileIcon: profileIcon ? profileIcon : '',
    status: getValidatorStatus(lcdValidator),
    jailed: lcdValidator.jailed,
    missedOracleVote: +missedVote || 0,
    votingPower: extendedValidator.votingPower,
    votingPowerWeight: extendedValidator.votingPowerWeight,
    commissionRate: lcdValidator.commission.commission_rates.rate,
    maxCommissionRate: lcdValidator.commission.commission_rates.max_rate,
    maxCommissionChangeRate: lcdValidator.commission.commission_rates.max_change_rate,
    rewardPoolTotal,
    commissionChangeDate: new Date(lcdValidator.commission.update_time),
    selfDelegation: selfDelegation?.balance.amount ?? '0.0',
    selfDelegationWeight: div(selfDelegation?.delegation.shares ?? '0.0', lcdValidator.delegator_shares),
    upTime: signingInfo ? getUptime(signingInfo) : 0,
    signingInfo,
    rewardPool: sortDenoms(rewardPool)
  }

  const repo = getRepository(ValidatorInfoEntity)
  const validator = await repo.findOne({ operatorAddress })

  if (!validator) {
    logger.info(`New validator found (operator address: ${operatorAddress}`)
    await repo.save(repo.create(validatorDetails))
  } else {
    logger.info(`Update existing validator (op addr: ${operatorAddress}`)
    await repo.update(validator.id, validatorDetails)
  }
}
