import * as sentry from '@sentry/node'
import { getMinutes } from 'date-fns'
import { getRepository, getManager, DeepPartial, EntityManager } from 'typeorm'
import * as Bluebird from 'bluebird'
import { bech32 } from 'bech32'

import config from 'config'
import { BlockEntity, BlockRewardEntity } from 'orm'
import { splitDenomAndAmount } from 'lib/common'
import { plus } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'
import * as lcd from 'lib/lcd'
import * as rpc from 'lib/rpc'
import { getTxHashesFromBlock } from 'lib/tx'

import { collectTxs } from './tx'
import { collectReward } from './reward'
import { collectNetwork } from './network'
import { collectPrice } from './price'
import { collectGeneral } from './general'

const validatorCache = new Map()

export async function getValidatorOperatorAddressByConsensusAddress(b64: string, height: string) {
  const operatorAddress = validatorCache.get(b64)

  if (operatorAddress) {
    return operatorAddress
  }

  const valsAndCons = await lcd.getValidatorsAndConsensus('BOND_STATUS_BONDED', height)

  valsAndCons.forEach((v) => {
    if (v.lcdConsensus && v.lcdConsensus.address) {
      const b64i = Buffer.from(bech32.fromWords(bech32.decode(v.lcdConsensus.address).words)).toString('base64')

      validatorCache.set(b64i, v.lcdValidator.operator_address)
    }
  })

  if (!validatorCache.has(b64)) {
    throw new Error(`cannot find ${b64} address at height ${height}`)
  }

  return validatorCache.get(b64)
}

async function getLatestIndexedBlock(): Promise<BlockEntity | undefined> {
  const latestBlock = await getRepository(BlockEntity).find({
    where: {
      chainId: config.CHAIN_ID
    },
    order: {
      id: 'DESC'
    },
    take: 1
  })

  if (!latestBlock || latestBlock.length === 0) {
    return
  }

  return latestBlock[0]
}

async function generateBlockEntity(
  lcdBlock: LcdBlock,
  blockReward: BlockRewardEntity
): Promise<DeepPartial<BlockEntity>> {
  const { chain_id: chainId, height, time: timestamp, proposer_address } = lcdBlock.block.header

  const blockEntity: DeepPartial<BlockEntity> = {
    chainId,
    height: +height,
    timestamp: new Date(timestamp),
    reward: blockReward,
    proposer: await getValidatorOperatorAddressByConsensusAddress(proposer_address, height)
  }

  return blockEntity
}

const totalRewardReducer = (acc: DenomMap, item: Coin & { validator: string }): DenomMap => {
  acc[item.denom] = plus(acc[item.denom], item.amount)
  return acc
}

const validatorRewardReducer = (acc: DenomMapByValidator, item: Coin & { validator: string }): DenomMapByValidator => {
  if (!acc[item.validator]) {
    acc[item.validator] = {}
  }

  acc[item.validator][item.denom] = plus(acc[item.validator][item.denom], item.amount)
  return acc
}

export async function getBlockReward(height: string): Promise<DeepPartial<BlockRewardEntity>> {
  const decodedRewardsAndCommission = await rpc.getRewards(height)

  const totalReward = {}
  const totalCommission = {}
  const rewardPerVal = {}
  const commissionPerVal = {}

  decodedRewardsAndCommission &&
    decodedRewardsAndCommission.forEach((item) => {
      if (!item.amount) {
        return
      }

      if (item.type === 'rewards') {
        const rewards = item.amount
          .split(',')
          .map((amount) => ({ ...splitDenomAndAmount(amount), validator: item.validator }))

        rewards.reduce(totalRewardReducer, totalReward)
        rewards.reduce(validatorRewardReducer, rewardPerVal)
      } else if (item.type === 'commission') {
        const commissions = item.amount
          .split(',')
          .map((amount) => ({ ...splitDenomAndAmount(amount), validator: item.validator }))

        commissions.reduce(totalRewardReducer, totalCommission)
        commissions.reduce(validatorRewardReducer, commissionPerVal)
      }
    })

  const blockReward: DeepPartial<BlockRewardEntity> = {
    reward: totalReward,
    commission: totalCommission,
    rewardPerVal,
    commissionPerVal
  }
  return blockReward
}

export async function saveBlockInformation(
  lcdBlock: LcdBlock,
  latestIndexedBlock: BlockEntity | undefined
): Promise<BlockEntity | undefined> {
  const height: string = lcdBlock.block.header.height
  logger.info(`collectBlock: begin transaction for block ${height}`)

  const result: BlockEntity | undefined = await getManager()
    .transaction(async (mgr: EntityManager) => {
      // Save block rewards
      const newBlockReward = await mgr.getRepository(BlockRewardEntity).save(await getBlockReward(height))
      // Save block entity
      const newBlockEntity = await mgr
        .getRepository(BlockEntity)
        .save(await generateBlockEntity(lcdBlock, newBlockReward))
      // get block tx hashes
      const txHashes = getTxHashesFromBlock(lcdBlock)

      if (txHashes.length) {
        // save transactions
        await collectTxs(mgr, txHashes, newBlockEntity)
      }

      // new block timestamp
      if (latestIndexedBlock && getMinutes(latestIndexedBlock.timestamp) !== getMinutes(newBlockEntity.timestamp)) {
        const newBlockTimeStamp = new Date(newBlockEntity.timestamp).getTime()

        await collectReward(mgr, newBlockTimeStamp, height)
        // await collectSwap(mgr, newBlockTimeStamp)
        await collectNetwork(mgr, newBlockTimeStamp, height)
        await collectPrice(mgr, newBlockTimeStamp, height)
        await collectGeneral(mgr, newBlockTimeStamp, height)
      }

      return newBlockEntity
    })
    .then((block: BlockEntity) => {
      logger.info('collectBlock: transaction finished')
      return block
    })
    .catch((err) => {
      logger.error(err)
      if (
        err instanceof Error &&
        typeof err.message === 'string' &&
        err.message.includes('transaction not found on node')
      ) {
        return undefined
      }
      sentry.captureException(err)
      return undefined
    })
  return result
}

export async function collectBlock(): Promise<void> {
  let latestHeight

  // Wait until it gets proper block
  while (!latestHeight) {
    const latestBlock = await lcd.getLatestBlock()

    if (latestBlock?.block) {
      latestHeight = Number(latestBlock.block.header.height)
      break
    }

    logger.info('collectBlock: waiting for the first block')
    await Bluebird.delay(1000)
  }

  let latestIndexedBlock = await getLatestIndexedBlock()
  let nextSyncHeight = latestIndexedBlock ? latestIndexedBlock.height + 1 : config.INITIAL_HEIGHT

  while (nextSyncHeight <= latestHeight) {
    const lcdBlock = await lcd.getBlock(nextSyncHeight.toString())

    if (!lcdBlock) {
      break
    }

    latestIndexedBlock = await saveBlockInformation(lcdBlock, latestIndexedBlock)

    // Exit the loop after transaction error whether there's more blocks or not
    if (!latestIndexedBlock) {
      break
    }

    nextSyncHeight = nextSyncHeight + 1
  }
}
