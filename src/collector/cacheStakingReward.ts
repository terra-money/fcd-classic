import config from 'config'
import * as rp from 'request-promise'
import { collectorLogger as logger } from 'lib/logger'

async function totalStakingReturnRequest() {
  await rp(`${config.FCD_URI}/v1/dashboard/staking_return`)
  logger.info(`Cache staking return completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/staking_return?count=7`)
  logger.info(`Cache staking return (count: 7) completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/staking_return?count=14`)
  logger.info(`Cache staking return (count: 14) completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/staking_return?count=30`)
  logger.info(`Cache staking return (count: 30) completed.`)
}

async function totalAccountRequest() {
  await rp(`${config.FCD_URI}/v1/dashboard/account_growth`)
  logger.info(`Cache accoutn growth completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/account_growth?count=7`)
  logger.info(`Cache accoutn growth (count: 7) completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/account_growth?count=14`)
  logger.info(`Cache accoutn growth (count: 14) completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/account_growth?count=30`)
  logger.info(`Cache accoutn growth (count: 30) completed.`)
}

async function txVolRequest() {
  await rp(`${config.FCD_URI}/v1/dashboard/tx_volume`)
  logger.info(`Cache accoutn growth completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/tx_volume?count=7`)
  logger.info(`Cache accoutn growth (count: 7) completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/tx_volume?count=14`)
  logger.info(`Cache accoutn growth (count: 14) completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/tx_volume?count=30`)
  logger.info(`Cache accoutn growth (count: 30) completed.`)
}

async function blockRewardsRequest() {
  await rp(`${config.FCD_URI}/v1/dashboard/block_rewards`)
  logger.info(`Cache accoutn growth completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/block_rewards?count=7`)
  logger.info(`Cache accoutn growth (count: 7) completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/block_rewards?count=14`)
  logger.info(`Cache accoutn growth (count: 14) completed.`)
  await rp(`${config.FCD_URI}/v1/dashboard/block_rewards?count=30`)
  logger.info(`Cache accoutn growth (count: 30) completed.`)
}

async function validatorStakingReturnRequest() {
  await rp(`${config.FCD_URI}/v1/staking`)
  await rp(`${config.FCD_URI}/v1/staking`)
  logger.info(`Cache validator return completed.`)
}

export default async function cache() {
  await totalStakingReturnRequest().catch((e) => {
    logger.error(`Cache staking return failed by ${e}`)
  })
  await validatorStakingReturnRequest().catch((e) => {
    logger.error(`Cache validator return failed by ${e}`)
  })
  await totalAccountRequest().catch((e) => {
    logger.error(`Cache total account failed by ${e}`)
  })
  await blockRewardsRequest().catch((e) => {
    logger.error(`Cache block reward failed by ${e}`)
  })
  await txVolRequest().catch((e) => {
    logger.error(`Cache tx vol failed by ${e}`)
  })
}
