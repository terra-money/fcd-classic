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
  [operatorAddress: string]: ValidatorReturnInfoEntity
}> {
  const existingReturnInfos = await getRepository(ValidatorReturnInfoEntity).find({
    where: {
      timestamp
    }
  })

  const valMap = existingReturnInfos.reduce((valMap, returnInfo: ValidatorReturnInfoEntity) => {
    valMap[returnInfo.operatorAddress] = returnInfo
    return valMap
  }, {})
  return valMap
}

export async function getValidatorsReturnOfTheDay(
  fromTs: number,
  validatorsList: LcdValidator[],
  updateExisting = false
): Promise<ValidatorReturnInfoEntity[]> {
  const retEntity: ValidatorReturnInfoEntity[] = []
  const timestamp = startOfDay(fromTs)

  logger.info(`Calculating validators return of ${timestamp}`)

  const priceObj = await getAvgPrice(fromTs, fromTs + ONE_DAY_IN_MS)
  const valMap = await getExistingValidatorsMap(timestamp)

  for (const validator of validatorsList) {
    if (!updateExisting && valMap[validator.operator_address]) {
      logger.info(`row already exists: ${validator.operator_address}`)
      continue
    }

    const validatorAvgVotingPower = await getAvgVotingPower(validator.operator_address, fromTs, fromTs + ONE_DAY_IN_MS)

    if (validatorAvgVotingPower) {
      const { reward, commission } = normalizeRewardAndCommissionToLuna(
        await getValidatorRewardAndCommissionSum(validator.operator_address, fromTs, fromTs + ONE_DAY_IN_MS),
        priceObj
      )

      logger.info(`${validator.operator_address}: ${timestamp} => reward ${reward} with commission of ${commission}`)

      const valRetEntity = valMap[validator.operator_address] || new ValidatorReturnInfoEntity()

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
