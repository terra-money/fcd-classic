import { startOfDay } from 'date-fns'
import { getRepository } from 'typeorm'

import { ValidatorReturnInfoEntity } from 'orm'

import { collectorLogger as logger } from 'lib/logger'
import { ONE_DAY_IN_MS } from 'lib/constant'

import { getAvgVotingPower, getAvgPrice } from 'service/staking'

import { normalizeRewardAndCommissionToLuna, getValidatorRewardAndCommissionSum } from './rewardAndCommissionSum'

async function getExistingValidatorsMap(
  timestamp: Date
): Promise<{
  [operatorAddress: string]: boolean
}> {
  const existingValidator = await getRepository(ValidatorReturnInfoEntity).find({
    select: ['operatorAddress'],
    where: {
      timestamp
    }
  })

  const valMap = existingValidator.reduce((valMap, validator: ValidatorReturnInfoEntity) => {
    valMap[validator.operatorAddress] = true
    return valMap
  }, {})
  return valMap
}

export async function getValidatorsReturnOfTheDay(
  fromTs: number,
  validatorsList: LcdValidator[]
): Promise<ValidatorReturnInfoEntity[]> {
  const retEntity: ValidatorReturnInfoEntity[] = []

  const timestamp = startOfDay(fromTs)

  logger.info(`Starting return for day of ${timestamp}`)

  logger.info('price info from db')
  const priceObj = await getAvgPrice(fromTs, fromTs + ONE_DAY_IN_MS)

  const valMap = await getExistingValidatorsMap(timestamp)

  for (const validator of validatorsList) {
    logger.info(`${validator.operator_address}: calculating return`)

    if (valMap[validator.operator_address]) {
      logger.info(`${validator.operator_address}: already exists in db`)
      continue
    }

    const validatorAvgVotingPower = await getAvgVotingPower(validator.operator_address, fromTs, fromTs + ONE_DAY_IN_MS)

    if (validatorAvgVotingPower) {
      const { reward, commission } = normalizeRewardAndCommissionToLuna(
        await getValidatorRewardAndCommissionSum(validator.operator_address, fromTs, fromTs + ONE_DAY_IN_MS),
        priceObj
      )
      logger.info(`${validator.operator_address}: ${timestamp} => reward ${reward} with commission of ${commission}`)
      const valRetEntity = new ValidatorReturnInfoEntity()
      valRetEntity.operatorAddress = validator.operator_address
      valRetEntity.timestamp = timestamp
      valRetEntity.reward = reward
      valRetEntity.commission = commission
      valRetEntity.avgVotingPower = validatorAvgVotingPower
      retEntity.push(valRetEntity)
    }
  }
  return retEntity
}
