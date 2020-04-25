import { format } from 'date-fns'
import { mergeWith } from 'lodash'
import { ValidatorReturnInfoEntity, BlockEntity } from 'orm'
import { getRepository } from 'typeorm'
import { getValidators } from 'lib/lcd'
import { plus, div } from 'lib/math'
import { vsLogger as logger } from 'lib/logger'
import { getBlockRewardsUncached, getAvgVotingPower, getAvgPrice } from 'service/staking'

async function getValidatorReturnSum(operatorAddress: string, blockRewards: any, priceObj: any) {
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
    { reward: {}, commission: {} }
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

  const latestBlockDateTime = format(latestBlock.timestamp, 'YYYY-MM-DD 00:00:00')
  const latestBlockTs = new Date(latestBlockDateTime).getTime()

  logger.info(`Latest block time ${latestBlockDateTime}`)

  const validatorsList = await getValidators()

  logger.info(`Got a list of ${validatorsList.length} validators`)
  const to = format(new Date(), 'YYYY-MM-DD 00:00:00')
  const toTs = new Date(to).getTime()
  const oneDayInMS = 60000 * 60 * 24
  const fiveDayInMS = oneDayInMS * 5
  const fromTs = toTs - fiveDayInMS

  if (fromTs > latestBlockTs) {
    logger.error('Block missing for days')
    logger.info('Missing current block data')
    return
  }

  logger.info(`Pre-calculator started for validators from date ${to.toString()}`)
  if (validatorsList) {
    // used -10 for just to make sure it doesn't calculate for today
    for (let tsIt = fromTs; tsIt < toTs - 10 && tsIt < latestBlockTs; tsIt = tsIt + oneDayInMS) {
      logger.info(`Staring return for day of ${format(tsIt, 'YYYY-MM-DD 00:00:00')}`)

      let blockRewards
      let priceObj

      for (const validator of validatorsList) {
        logger.info(`Calculating return for validator: ${validator.operator_address}`)
        const infoExists = await getRepository(ValidatorReturnInfoEntity).findOne({
          operatorAddress: validator.operator_address,
          timestamp: format(tsIt, 'YYYY-MM-DD 00:00:00')
        })

        if (infoExists) {
          logger.info(`Return for operator ${validator.operator_address} already exists in db`)
          continue
        }

        if (!blockRewards) {
          logger.info('Pulling block reward data, price info from db')
          blockRewards = await getBlockRewardsUncached(tsIt, tsIt + oneDayInMS)
          priceObj = await getAvgPrice(tsIt, tsIt + oneDayInMS)
        }

        logger.info('Pulling avg voting power info')
        const validatorAvgVotingPower = await getAvgVotingPower(validator.operator_address, tsIt, tsIt + oneDayInMS)
        if (validatorAvgVotingPower) {
          const { reward, commission } = await getValidatorReturnSum(validator.operator_address, blockRewards, priceObj)
          logger.info(`Calculated return for op ${validator.operator_address} of date ${format(
            tsIt,
            'YYYY-MM-DD 00:00:00'
          )} 
              => reward ${reward} with commission of ${commission}`)
          await getRepository(ValidatorReturnInfoEntity).save({
            operatorAddress: validator.operator_address,
            timestamp: format(tsIt, 'YYYY-MM-DD 00:00:00'),
            reward,
            commission,
            avgVotingPower: validatorAvgVotingPower
          })
          logger.info(`Return saved for operator ${validator.operator_address}`)
        }
        logger.info(`Return completed for operator ${validator.operator_address}`)
      }
      logger.info(`Calculated return for day of ${format(tsIt, 'YYYY-MM-DD 00:00:00')}`)
    }
  }
  logger.info('Calculated last 30 days return')
}
