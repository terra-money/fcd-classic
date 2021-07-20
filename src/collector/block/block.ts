import * as sentry from '@sentry/node'
import { getMinutes } from 'date-fns'
import { getRepository, getManager, DeepPartial, EntityManager } from 'typeorm'
import * as Bluebird from 'bluebird'

import config from 'config'
import { BlockEntity, BlockRewardEntity } from 'orm'
import { splitDenomAndAmount } from 'lib/common'
import { plus } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'
import * as lcd from 'lib/lcd'
import * as rpc from 'lib/rpc'

import { saveTxs, generateTxEntities } from './tx'
import { saveWasmCodeAndContract } from './wasm'

import { collectReward } from 'collector/reward'
import { collectNetwork } from 'collector/network'
import { collectPrice } from 'collector/price'
import { collectGeneral } from 'collector/general'
import { detectAndUpdateProposal } from 'collector/gov'

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

function getBlockEntity(
  blockHeight: number,
  lcdBlock: LcdBlock,
  blockReward: BlockRewardEntity
): DeepPartial<BlockEntity> {
  const chainId = lcdBlock.block.header.chain_id
  const timestamp = lcdBlock.block.header.time

  const blockEntity: DeepPartial<BlockEntity> = {
    chainId,
    height: blockHeight,
    timestamp,
    reward: blockReward
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

export async function getBlockReward(lcdBlock: LcdBlock): Promise<DeepPartial<BlockRewardEntity>> {
  const height = +lcdBlock.block.header.height
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
      const newBlockReward = await mgr.getRepository(BlockRewardEntity).save(await getBlockReward(lcdBlock))
      // new block height
      const newBlockHeight = +height
      // Save block entity
      const newBlockEntity = await mgr
        .getRepository(BlockEntity)
        .save(getBlockEntity(newBlockHeight, lcdBlock, newBlockReward))

      // get block tx hashes
      const txHashes = lcd.getTxHashesFromBlock(lcdBlock)

      if (txHashes) {
        const txEntities = await generateTxEntities(txHashes, height, newBlockEntity)
        // save transactions
        await saveTxs(mgr, newBlockEntity, txEntities)
        // save wasm
        await saveWasmCodeAndContract(mgr, txEntities)
        // save proposals
        await detectAndUpdateProposal(mgr, txEntities)
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
