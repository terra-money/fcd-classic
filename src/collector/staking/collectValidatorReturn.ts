import { startOfDay } from 'date-fns'
import { getRepository } from 'typeorm'

import { ValidatorReturnInfoEntity, BlockEntity } from 'orm'

import { ExtendedValidator, getValidatorsAndConsensus } from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { ONE_DAY_IN_MS } from 'lib/constant'
import { div, getIntegerPortion } from 'lib/math'
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

export async function generateValidatorReturnEntities(
  fromTs: number,
  extValidators: ExtendedValidator[],
  updateExisting = false
): Promise<ValidatorReturnInfoEntity[]> {
  const retEntity: ValidatorReturnInfoEntity[] = []
  const timestamp = startOfDay(fromTs)
  const priceObj = await getAvgPrice(fromTs, fromTs + ONE_DAY_IN_MS)
  const valMap = await getExistingValidatorsMap(timestamp)

  for (const extValidator of extValidators) {
    const { lcdValidator: validator, votingPower } = extValidator

    if (!updateExisting && valMap[validator.operator_address]) {
      logger.info(`collectValidatorReturn: skipping ${validator.description.moniker}`)
      continue
    }

    const validatorAvgVotingPower = await getAvgVotingPower(validator, fromTs, fromTs + ONE_DAY_IN_MS, votingPower)

    if (validatorAvgVotingPower) {
      const { reward, commission } = normalizeRewardAndCommissionToLuna(
        await getValidatorRewardAndCommissionSum(validator.operator_address, fromTs, fromTs + ONE_DAY_IN_MS),
        priceObj
      )

      logger.info(
        `collectValidatorReturn: reward ${validator.description.moniker}, total ${getIntegerPortion(
          div(reward, 1000000)
        )}, commission ${getIntegerPortion(div(commission, 1000000))}`
      )

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
  const latestBlock = await getRepository(BlockEntity).findOne({ order: { id: 'DESC' } })

  if (latestBlock === undefined) {
    logger.error('collectValidatorReturn: No block data found in DB')
    return
  }

  const latestBlockDateTime = startOfDay(latestBlock.timestamp)
  const latestBlockTs = latestBlockDateTime.getTime()

  const toTs = startOfDay(Date.now()).getTime()
  const fromTs = toTs - ONE_DAY_IN_MS * 3

  if (latestBlockTs < toTs) {
    logger.error(`collectValidatorReturn: Required to have blocks until ${new Date(toTs)}`)
    return
  }

  const validatorsList = await getValidatorsAndConsensus('BOND_STATUS_BONDED')
  logger.info(`collectValidatorReturn: ${validatorsList.length} validators at ${latestBlockDateTime.toString()}`)

  const validatorReturnRepo = getRepository(ValidatorReturnInfoEntity)

  for (let tsIt = fromTs; tsIt < toTs && tsIt < latestBlockTs; tsIt = tsIt + ONE_DAY_IN_MS) {
    const dailyEntityList = await generateValidatorReturnEntities(tsIt, validatorsList)

    await validatorReturnRepo.save(dailyEntityList)
  }

  logger.info('collectValidatorReturn: completed')
}
