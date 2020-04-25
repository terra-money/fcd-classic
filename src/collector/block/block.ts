import { get } from 'lodash'
import { getTime, getMinutes } from 'date-fns'
import config from 'config'
import { getRepository, getManager, DeepPartial, EntityManager } from 'typeorm'
import { BlockEntity, BlockRewardEntity } from 'orm'
import * as lcd from 'lib/lcd'
import * as rpc from 'lib/rpc'
import { saveTxs } from './tx'
import { splitDenomAndAmount } from 'lib/common'
import { plus } from 'lib/math'

import { setReward } from 'collector/reward'
import { setSwap } from 'collector/swap'
import { setNetwork } from 'collector/network'

function getTxHashesFromBlock(block): string[] {
  const numTxs = Number(get(block, 'block.header.num_txs'))

  if (!numTxs || numTxs === 0) {
    return []
  }

  const txStrings = get(block, 'block.data.txs')

  const hashes = txStrings.map(lcd.getTxHash)
  return hashes
}

async function getRecentlySyncedBlock(): Promise<BlockEntity | undefined> {
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
  block: LcdBlock,
  blockreward: BlockRewardEntity
): DeepPartial<BlockEntity> {
  const chainId = get(block, 'block.header.chain_id')
  const timestamp = get(block, 'block.header.time')

  const blockEntity: DeepPartial<BlockEntity> = {
    chainId,
    height: blockHeight,
    data: block,
    timestamp,
    reward: blockreward
  }
  return blockEntity
}

type DenomMapByValidator = { [validator: string]: DenomMap }

const totalRewardReducer = (acc: DenomMap, item: Coin): DenomMap => {
  acc[item.denom] = plus(acc[item.denom] || '0', item.amount)
  return acc
}

const validatorRewardReducer = (acc: DenomMapByValidator, item: Coin & { validator: string }): DenomMapByValidator => {
  if (!acc[item.validator]) {
    acc[item.validator] = {}
  }

  acc[item.validator][item.denom] = plus(acc[item.validator][item.denom] || '0', item.amount)
  return acc
}

export async function getBlockReward(block: LcdBlock): Promise<DeepPartial<BlockRewardEntity>> {
  const height = get(block, 'block_meta.header.height')
  const chainId = get(block, 'block_meta.header.chain_id')
  const timestamp = get(block, 'block_meta.header.time')

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
      } else if (item.type === 'commission' && item.amount) {
        const commissions = item.amount
          .split(',')
          .map((amount) => ({ ...splitDenomAndAmount(amount), validator: item.validator }))

        commissions.reduce(totalRewardReducer, totalCommission)
        commissions.reduce(validatorRewardReducer, commissionPerVal)
      }
    })

  const blockReward: DeepPartial<BlockRewardEntity> = {
    chainId,
    height,
    timestamp,
    reward: totalReward,
    commission: totalCommission,
    rewardPerVal,
    commissionPerVal
  }
  return blockReward
}

export function isNewMinuteBlock(prevBlock: BlockEntity | undefined, newBlock: BlockEntity): number {
  const prevBlockTime = get(prevBlock, 'data.block.header.time')
  const newBlockTime = get(newBlock, 'data.block.header.time')

  if (prevBlockTime && getMinutes(prevBlockTime) !== getMinutes(newBlockTime)) {
    return getTime(newBlockTime)
  }

  return 0
}

interface NewBlockInfo {
  hasMoreBlocks: boolean
  lastSyncedBlock?: BlockEntity
  lcdBlock?: LcdBlock
}
export async function getLastestBlockInfo(): Promise<NewBlockInfo> {
  const recentlySyncedBlock = await getRecentlySyncedBlock()
  const recentlySyncedBlockNumber = recentlySyncedBlock ? recentlySyncedBlock.height : 0
  let hasMoreBlocks = false
  let lcdBlock: LcdBlock | undefined
  const latestBlock = await lcd.getLatestBlock()
  const latestBlockHeight = Number(get(latestBlock, 'block.header.height'))

  if (latestBlockHeight <= recentlySyncedBlockNumber) {
    return { hasMoreBlocks, lastSyncedBlock: recentlySyncedBlock }
  }

  const newBlockNumber = recentlySyncedBlockNumber + 1

  if (newBlockNumber === latestBlockHeight) {
    lcdBlock = latestBlock
  } else {
    hasMoreBlocks = true
    lcdBlock = await lcd.getBlock(newBlockNumber)
  }

  return {
    hasMoreBlocks,
    lcdBlock,
    lastSyncedBlock: recentlySyncedBlock
  }
}

export async function saveLatestBlock(): Promise<void> {
  let hasNextBlocks = true

  while (hasNextBlocks) {
    const { hasMoreBlocks, lcdBlock: lcdBlock, lastSyncedBlock } = await getLastestBlockInfo()

    if (lcdBlock) {
      await getManager().transaction(async (transactionalEntityManager: EntityManager) => {
        // Save block rewards
        const newBlockRewad = await transactionalEntityManager
          .getRepository(BlockRewardEntity)
          .save(await getBlockReward(lcdBlock))
        // new block height
        const newBlockHeight = Number(get(lcdBlock, 'block.header.height'))
        // Save block entity
        const newBlockEntity = await transactionalEntityManager
          .getRepository(BlockEntity)
          .save(getBlockEntity(newBlockHeight, lcdBlock, newBlockRewad))
        // get block tx hashes
        const blockHashes = getTxHashesFromBlock(lcdBlock)
        // new block timestamp
        const newBlockTimeStamp = isNewMinuteBlock(lastSyncedBlock, newBlockEntity)

        if (blockHashes) {
          // save transactions
          await saveTxs(transactionalEntityManager, newBlockEntity, blockHashes)
        }

        if (newBlockTimeStamp) {
          await setReward(transactionalEntityManager, newBlockTimeStamp)
          await setSwap(transactionalEntityManager, newBlockTimeStamp)
          await setNetwork(transactionalEntityManager, newBlockTimeStamp)
        }
      })
    }

    hasNextBlocks = hasMoreBlocks
  }
}
