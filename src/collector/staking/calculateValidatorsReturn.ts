import { startOfDay } from 'date-fns'
import { getRepository } from 'typeorm'

import { ValidatorReturnInfoEntity, BlockEntity } from 'orm'

import { getValidators } from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'

import { getAvgVotingPower, getAvgPrice } from 'service/staking'

import { normalizeRewardAndCommisionToLuna, getValidatorRewardAndCommissionSum } from './rewadAndCommissionSum'

export async function calculateValidatorsReturn() {
  logger.info('Validator return calculator started.')

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
  const oneDayInMS = 60000 * 60 * 24
  const threeDayInMs = oneDayInMS * 5
  const fromTs = toTs - threeDayInMs

  if (fromTs > latestBlockTs) {
    logger.info('Missing current block data')
    return
  }

  const validatorsList = await getValidators()
  logger.info(`Got a list of ${validatorsList.length} validators`)

  if (!validatorsList) {
    return
  }

  logger.info(`Pre-calculator started for validators from date ${to.toString()}`)
  // used -10 for just to make sure it doesn't calculate for today
  toTs -= 10

  for (let tsIt = fromTs; tsIt < toTs && tsIt < latestBlockTs; tsIt = tsIt + oneDayInMS) {
    const timestamp = startOfDay(tsIt)

    logger.info(`Starting return for day of ${timestamp}`)

    logger.info('Pulling block reward data, price info from db')
    const priceObj = await getAvgPrice(tsIt, tsIt + oneDayInMS)

    const existingValidator = await getRepository(ValidatorReturnInfoEntity).find({
      select: ['operatorAddress'],
      where: {
        timestamp
      }
    })

    const valMap = existingValidator.reduce((valMap, validator: ValidatorReturnInfoEntity) => {
      valMap[validator.operatorAddress] = true
      return valMap
    })

    for (const validator of validatorsList) {
      logger.info(`${validator.operator_address}: calculating return`)

      if (valMap[validator.operator_address]) {
        logger.info(`${validator.operator_address}: already exists in db`)
        continue
      }

      const validatorAvgVotingPower = await getAvgVotingPower(validator.operator_address, tsIt, tsIt + oneDayInMS)

      if (validatorAvgVotingPower) {
        const { reward, commission } = normalizeRewardAndCommisionToLuna(
          await getValidatorRewardAndCommissionSum(validator.operator_address, tsIt, tsIt + oneDayInMS),
          priceObj
        )
        logger.info(`${validator.operator_address}: ${timestamp} => reward ${reward} with commission of ${commission}`)
        await getRepository(ValidatorReturnInfoEntity).save({
          operatorAddress: validator.operator_address,
          timestamp,
          reward,
          commission,
          avgVotingPower: validatorAvgVotingPower
        })
      }
    }

    logger.info(`Calculated return for day of ${timestamp}`)
  }

  logger.info('Validator return calculator completed.')
}
