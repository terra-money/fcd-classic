import * as Bluebird from 'bluebird'
import { getRepository, EntityManager } from 'typeorm'
import { get, mergeWith } from 'lodash'

import config from 'config'
import { TxEntity, RewardEntity, BlockEntity } from 'orm'

import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { plus, minus } from 'lib/math'
import { isNumeric, splitDenomAndAmount } from 'lib/common'
import { getDateRangeOfLastMinute, getQueryDateTime, getStartOfPreviousMinuteTs } from 'lib/time'

import { getUSDValue, getAllActivePrices, addDatetimeFilterToQuery } from './helper'

function extractGasFee(tx: TxEntity): DenomMap {
  const amount = get(tx, 'data.tx.value.fee.amount')

  return (amount || []).reduce((acc, item) => {
    acc[item.denom] = acc[item.denom] ? plus(acc[item.denom], item.amount) : item.amount
    return acc
  }, {})
}

type ExtraFee = {
  swapfee?: DenomMap
  tax?: DenomMap
}

function extractExtraFee(tx): ExtraFee {
  const logs = get(tx, 'data.logs')
  return logs
    ? logs.reduce(
        (acc, item) => {
          const taxes = get(item, 'log.tax')
          const swapfee = get(item, 'log.swap_fee')
          if (taxes) {
            taxes.split(',').forEach((tax) => {
              const { amount, denom } = splitDenomAndAmount(tax)
              acc.tax[denom] = plus(acc.tax[denom], amount)
            })
          }
          if (swapfee) {
            const { amount, denom } = splitDenomAndAmount(swapfee)

            if (isNumeric(amount)) {
              acc.swapfee[denom] = plus(acc.swapfee[denom], amount)
            }
          }
          return acc
        },
        { swapfee: {}, tax: {} }
      )
    : {}
}

async function getFees(timestamp: number): Promise<{
  swapfee: DenomMap
  tax: DenomMap
  gas: DenomMap
}> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx').select(`tx.data`)
  addDatetimeFilterToQuery(timestamp, qb)

  // .leftJoinAndSelect("tx.block", "block")
  // .where("tx.block_id is not null");

  const txs = await qb.getMany()
  const rewardMerger = (obj, src) => mergeWith(obj, src, (o, s) => plus(o, s))

  return txs.reduce(
    (acc, tx) => {
      const gas = extractGasFee(tx)
      const swapFeeAndTax = extractExtraFee(tx)
      return mergeWith(acc, { ...swapFeeAndTax, gas }, rewardMerger)
    },
    { swapfee: {}, tax: {}, gas: {} }
  )
}

interface Rewards {
  reward: DenomMap
  commission: DenomMap
}

export async function getRewards(timestamp: number): Promise<Rewards> {
  const result: Rewards = { reward: {}, commission: {} }
  const { from, to } = getDateRangeOfLastMinute(timestamp)
  const qb = getRepository(BlockEntity)
    .createQueryBuilder('block')
    .leftJoinAndSelect('block.reward', 'reward')
    .andWhere(`block.timestamp >= '${getQueryDateTime(from)}'`)
    .andWhere(`block.timestamp < '${getQueryDateTime(to)}'`)

  const blocks: BlockEntity[] = await qb.getMany()

  if (!blocks.length) {
    return result
  }

  const lastBlock = await getRepository(BlockEntity).findOne({
    chainId: config.CHAIN_ID,
    height: blocks[blocks.length - 1].height + 1
  })

  if (lastBlock) {
    blocks.push(lastBlock)
  }

  blocks.shift()

  const rewardMerger = (obj, src) => mergeWith(obj, src, (o, s) => plus(o, s))

  return blocks.reduce((acc, block) => {
    const reward = block.reward.reward
    const commission = block.reward.commission
    return mergeWith(acc, { reward, commission }, rewardMerger)
  }, result)
}

export async function collectReward(mgr: EntityManager, timestamp: number, strHeight: string) {
  const { reward: rewardSum, commission } = await getRewards(timestamp)
  const datetime = new Date(getStartOfPreviousMinuteTs(timestamp))
  const [issuances, rewards, activePrices] = await Promise.all([
    lcd.getAllActiveIssuance(strHeight),
    getFees(timestamp),
    getAllActivePrices(datetime.getTime())
  ])

  await Bluebird.map(Object.keys(issuances), async (denom) => {
    const reward = new RewardEntity()
    reward.denom = denom
    reward.datetime = datetime
    reward.tax = get(rewards, `tax.${denom}`, '0.0')
    reward.taxUsd = getUSDValue(denom, reward.tax, activePrices)
    reward.gas = get(rewards, `gas.${denom}`, '0.0')
    reward.gasUsd = getUSDValue(denom, reward.gas, activePrices)
    reward.sum = rewardSum[denom]
    reward.commission = commission[denom]

    const oracle = minus(minus(reward.sum, reward.tax), reward.gas)
    reward.oracle = Number(oracle) < 0 ? '0' : oracle
    reward.oracleUsd = getUSDValue(denom, reward.oracle, activePrices)

    const existing = await mgr.findOne(RewardEntity, { denom, datetime })

    if (existing) {
      mgr.update(RewardEntity, existing.id, reward)
    } else {
      mgr.insert(RewardEntity, reward)
    }
  })

  logger.info(`collectReward: ${datetime}`)
}
