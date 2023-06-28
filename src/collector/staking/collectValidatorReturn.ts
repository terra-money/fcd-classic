import { startOfDay } from 'date-fns'
import { getRepository } from 'typeorm'

import { ValidatorReturnInfoEntity, BlockEntity } from 'orm'

import { ExtendedValidator, getValidatorsAndConsensus } from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { ONE_DAY_IN_MS } from 'lib/constant'
import { getAvgVotingPower } from 'service/staking'
import { getAvgPrice } from 'service/market/getAvgPrice'
import { normalizeRewardAndCommissionToLuna, getValidatorRewardAndCommissionSum } from './rewardAndCommissionSum'

async function getExistingValidatorsMap(timestamp: Date): Promise<{
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

export async function generateValidatorReturns(
  fromTs: number,
  extValidators: ExtendedValidator[],
  updateExisting = false
): Promise<ValidatorReturnInfoEntity[]> {
  const retEntity: ValidatorReturnInfoEntity[] = []
  const timestamp = startOfDay(fromTs)

  logger.info(`Calculating validators return of ${timestamp}`)

  const priceObj = await getAvgPrice(fromTs, fromTs + ONE_DAY_IN_MS)
  const valMap = await getExistingValidatorsMap(timestamp)

  for (const extValidator of extValidators) {
    const { lcdValidator: validator, votingPower } = extValidator

    if (!updateExisting && valMap[validator.operator_address]) {
      logger.info(`row already exists: ${validator.operator_address}`)
      continue
    }

    const validatorAvgVotingPower = await getAvgVotingPower(validator, fromTs, fromTs + ONE_DAY_IN_MS, votingPower)

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

export async function collectValidatorReturn() {
  logger.info('Validator return collector started.')

  const latestBlock = await getRepository(BlockEntity).findOne({ order: { id: 'DESC' } })

  if (latestBlock === undefined) {
    logger.error('No block data found in DB')
    return
  }

  const latestBlockDateTime = startOfDay(latestBlock.timestamp)
  const latestBlockTs = latestBlockDateTime.getTime()
  logger.info(`Latest collected block time ${latestBlockDateTime.toString()}`)

  const toTs = startOfDay(Date.now()).getTime()
  const fromTs = toTs - ONE_DAY_IN_MS * 3

  if (latestBlockTs < toTs) {
    logger.error(`Required to have blocks until ${new Date(toTs)}`)
    return
  }

  const validatorsList = await getValidatorsAndConsensus()
  logger.info(`Got a list of ${validatorsList.length} validators`)
  logger.info(`Pre-calculator started for validators from date ${latestBlockDateTime}`)

  const validatorReturnRepo = getRepository(ValidatorReturnInfoEntity)

  for (let tsIt = fromTs; tsIt < toTs && tsIt < latestBlockTs; tsIt = tsIt + ONE_DAY_IN_MS) {
    const dailyEntityList = await generateValidatorReturns(tsIt, validatorsList)

    await validatorReturnRepo.save(dailyEntityList)
    logger.info(`Calculated and got return for day of ${startOfDay(tsIt)}`)
  }

  logger.info('Validator return calculator completed.')
}
