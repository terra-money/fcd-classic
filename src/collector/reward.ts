import { format } from 'date-fns'
import config from 'config'
import * as moment from 'moment'
import { TxEntity, RewardEntity, BlockEntity } from 'orm'
import { getRepository, EntityManager } from 'typeorm'
import * as lcd from 'lib/lcd'
import logger from 'lib/logger'
import { plus, minus } from 'lib/math'
import { isNumeric, splitDenomAndAmount } from 'lib/common'
import { get, mergeWith } from 'lodash'
import { getUSDValue, getAllActivePrices, addDatetimeFilterToQuery } from './helper'

function getGas(tx) {
  const gasInfo = get(tx, 'data.tx.value.fee.amount')

  return gasInfo
    ? gasInfo.reduce((acc, item) => {
        acc[item.denom] = acc[item.denom] ? plus(acc[item.denom], item.amount) : item.amount
        return acc
      }, {})
    : {}
}

function getFee(tx) {
  const logs = get(tx, 'data.logs')
  return logs
    ? logs.reduce(
        (acc, item) => {
          const taxes = get(item, 'log.tax')
          const swapfee = get(item, 'log.swap_fee')
          if (taxes) {
            taxes.split(',').forEach((tax) => {
              const { amount, denom } = splitDenomAndAmount(tax)
              acc.tax[denom] = plus(acc.tax[denom] || '0', amount)
            })
          }
          if (swapfee) {
            const { amount, denom } = splitDenomAndAmount(swapfee)

            if (isNumeric(amount)) {
              acc.swapfee[denom] = plus(acc.swapfee[denom] || '0', amount)
            }
          }
          return acc
        },
        { swapfee: {}, tax: {} }
      )
    : {}
}

async function getFees(
  timestamp: number
): Promise<{
  swapfee: object
  tax: object
  gas: object
}> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx').select(`tx.data`)
  addDatetimeFilterToQuery(timestamp, qb)

  // .leftJoinAndSelect("tx.block", "block")
  // .where("tx.block_id is not null");

  const txs = await qb.getMany()

  const rewardMerger = (obj, src) => {
    return mergeWith(obj, src, (o, s) => {
      return plus(o, s)
    })
  }

  return txs.reduce(
    (acc, tx) => {
      const gas = getGas(tx)
      const fee = getFee(tx)
      return mergeWith(acc, { ...fee, gas }, rewardMerger)
    },
    { swapfee: {}, tax: {}, gas: {} }
  )
}

interface Rewards {
  reward: {
    [denom: string]: string
  }
  commission: {
    [denom: string]: string
  }
}

export async function getRewards(timestamp: number): Promise<Rewards> {
  const result: Rewards = { reward: {}, commission: {} }
  const to = moment(timestamp - (timestamp % 60000)).format('YYYY-MM-DD HH:mm:ss')
  const from = moment(timestamp - (timestamp % 60000) - 60000).format('YYYY-MM-DDTHH:mm:ss')
  const qb = getRepository(BlockEntity)
    .createQueryBuilder('block')
    .leftJoinAndSelect('block.reward', 'reward')
    .andWhere(`block.timestamp >= '${from}'`)
    .andWhere(`block.timestamp < '${to}'`)

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

export async function getRewardDocs(timestamp: number): Promise<RewardEntity[]> {
  const { reward: rewardSum, commission } = await getRewards(timestamp)
  const [issuances, rewards, activePrices] = await Promise.all([
    lcd.getAllActiveIssuance(),
    getFees(timestamp),
    getAllActivePrices(timestamp - (timestamp % 60000) - 60000)
  ])

  return Object.keys(issuances).map((denom) => {
    const reward = new RewardEntity()
    reward.denom = denom
    reward.datetime = new Date(timestamp - (timestamp % 60000) - 60000)
    reward.tax = get(rewards, `tax.${denom}`) ? get(rewards, `tax.${denom}`) : '0'
    reward.taxUsd = getUSDValue(denom, reward.tax, activePrices)
    reward.gas = get(rewards, `gas.${denom}`) ? get(rewards, `gas.${denom}`) : '0'
    reward.gasUsd = getUSDValue(denom, reward.gas, activePrices)
    reward.sum = rewardSum[denom]
    reward.commission = commission[denom]

    const oracle = minus(minus(reward.sum, reward.tax), reward.gas)
    reward.oracle = Number(oracle) < 0 ? '0' : oracle

    reward.oracleUsd = getUSDValue(denom, reward.oracle, activePrices)
    return reward
  })
}

export async function setReward(transactionEntityManager: EntityManager, timestamp: number) {
  const target = format(timestamp - (timestamp % 60000) - 60000, 'YYYY/MM/DD HH:mm:ss')
  const rewardEntity = await getRewardDocs(timestamp)
  await transactionEntityManager.save(rewardEntity)
  logger.info(`Save reward / ${target} - success.`)
}
