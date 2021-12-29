import { startOfDay } from 'date-fns'
import { getRepository } from 'typeorm'

import { ValidatorReturnInfoEntity, BlockEntity } from 'orm'

import { ExtendedValidator, getExtendedValidators } from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { ONE_DAY_IN_MS } from 'lib/constant'
import { getAvgVotingPower, getAvgPrice } from 'service/staking'
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

  const latestBlock = await getRepository(BlockEntity)
    .createQueryBuilder('block')
    .orderBy('block.id', 'DESC')
    .limit(1)
    .getOne()

  if (latestBlock === undefined) {
    logger.error('No block data found in db')
    return
  }

  const latestBlockDateTime = startOfDay(latestBlock.timestamp)
  const latestBlockTs = latestBlockDateTime.getTime()
  logger.info(`Latest block time ${latestBlockDateTime.toString()}`)

  const to = startOfDay(Date.now())
  let toTs = to.getTime()
  const threeDayInMs = ONE_DAY_IN_MS * 3
  const fromTs = toTs - threeDayInMs

  if (fromTs > latestBlockTs) {
    logger.info('Missing current block data')
    return
  }

  const validatorsList = await getExtendedValidators()
  logger.info(`Got a list of ${validatorsList.length} validators`)
  logger.info(`Pre-calculator started for validators from date ${to.toString()}`)
  // used -10 for just to make sure it doesn't calculate for today
  toTs -= 10

  const validatorReturnRepo = getRepository(ValidatorReturnInfoEntity)

  for (let tsIt = fromTs; tsIt < toTs && tsIt < latestBlockTs; tsIt = tsIt + ONE_DAY_IN_MS) {
    const dailyEntityList = await generateValidatorReturns(tsIt, validatorsList)

    await validatorReturnRepo.save(dailyEntityList)
    logger.info(`Calculated and got return for day of ${startOfDay(tsIt)}`)
  }

  logger.info('Validator return calculator completed.')
}
