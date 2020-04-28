import { startOfDay } from 'date-fns'
import { mergeWith } from 'lodash'
import { ValidatorReturnInfoEntity, BlockEntity } from 'orm'
import { getRepository } from 'typeorm'
import { getValidators } from 'lib/lcd'
import { plus, div } from 'lib/math'
import { vsLogger as logger } from 'lib/logger'
import { getBlockRewards, getAvgVotingPower, getAvgPrice } from 'service/staking'

async function getValidatorReturnSum(
  operatorAddress: string,
  blockRewards: BlockReward[],
  priceObj: DenomMap
): Promise<{
  reward: string
  commission: string
}> {
  const rewardMerger = (obj, src) => {
    return mergeWith(obj, src, (o, s) => {
      return plus(o, s)
    })
  }

  const { reward: rewardObj, commission: commissionObj } = blockRewards.reduce(
    (acc, block) => {
      const reward = block.reward_per_val[operatorAddress] || {}
      const commission = block.commission_per_val[operatorAddress] || {}
      return mergeWith(acc, { ...{ reward }, commission }, rewardMerger)
    },
    { reward: {} as DenomMap, commission: {} as DenomMap }
  )

  const reward = Object.keys(rewardObj).reduce((acc, denom) => {
    const amountConvertedLuna = denom === 'uluna' ? rewardObj[denom] : div(rewardObj[denom], priceObj[denom])
    return plus(acc, amountConvertedLuna)
  }, '0')

  const commission = Object.keys(commissionObj).reduce((acc, denom) => {
    const amountConvertedLuna = denom === 'uluna' ? commissionObj[denom] : div(commissionObj[denom], priceObj[denom])
    return plus(acc, amountConvertedLuna)
  }, '0')

  return { reward, commission }
}

export async function calculateValidatorsReturn() {
  logger.info('Return calculator started.')

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
  const fiveDayInMS = oneDayInMS * 5
  const fromTs = toTs - fiveDayInMS

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
    const blockRewards = await getBlockRewards(tsIt, tsIt + oneDayInMS)
    const priceObj = await getAvgPrice(tsIt, tsIt + oneDayInMS)

    for (const validator of validatorsList) {
      logger.info(`${validator.operator_address}: calculating return`)

      const infoExists = await getRepository(ValidatorReturnInfoEntity).findOne({
        operatorAddress: validator.operator_address,
        timestamp
      })

      if (infoExists) {
        logger.info(`${validator.operator_address}: already exists in db`)
        continue
      }

      const validatorAvgVotingPower = await getAvgVotingPower(validator.operator_address, tsIt, tsIt + oneDayInMS)

      if (validatorAvgVotingPower) {
        const { reward, commission } = await getValidatorReturnSum(validator.operator_address, blockRewards, priceObj)
        logger.info(`${validator.operator_address}: ${timestamp} 
=> reward ${reward} with commission of ${commission}`)
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

  logger.info('Calculated last 30 days return')
}
