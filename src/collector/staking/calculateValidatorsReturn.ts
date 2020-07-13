import { startOfDay } from 'date-fns'
import { getRepository } from 'typeorm'

import { ValidatorReturnInfoEntity, BlockEntity } from 'orm'

import { getValidators } from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { ONE_DAY_IN_MS } from 'lib/constant'

import { getValidatorsReturnOfTheDay } from './validatorsDailyReturn'

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
  const threeDayInMs = ONE_DAY_IN_MS * 3
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

  const valRetInfoEntityList: ValidatorReturnInfoEntity[] = []

  for (let tsIt = fromTs; tsIt < toTs && tsIt < latestBlockTs; tsIt = tsIt + ONE_DAY_IN_MS) {
    const dailyEntityList = await getValidatorsReturnOfTheDay(tsIt, validatorsList)

    valRetInfoEntityList.push(...dailyEntityList)

    logger.info(`Calculated and got return for day of ${startOfDay(tsIt)}`)
  }
  if (valRetInfoEntityList.length) {
    await getRepository(ValidatorReturnInfoEntity).save(valRetInfoEntityList)
    logger.info(`Stored daily ${valRetInfoEntityList.length} daily return`)
  }
  logger.info('Validator return calculator completed.')
}
