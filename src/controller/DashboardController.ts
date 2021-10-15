import 'koa-body'
import { KoaController, Get, Controller } from 'koa-joi-controllers'

import { success } from 'lib/response'

import {
  getGeneralInfo,
  getTransactionVol,
  getBlockRewards,
  getSeigniorageProceeds,
  getStakingReturn,
  getStakingRatio,
  getAccountGrowth,
  getActiveAccounts,
  getRegisteredAccounts,
  lastHourOpsAndTxs
} from 'service/dashboard'

@Controller(`/dashboard`)
export default class DashboardController extends KoaController {
  /**
   * @api {get} /dashboard Get information to be used on the dashboard
   * @apiName getDashboard
   * @apiGroup Dashboard
   *
   * @apiSuccess {Object} prices Current oracle price
   * @apiSuccess {string} prices.ukrw ukrw amount
   * @apiSuccess {string} prices.uluna uluna amount
   * @apiSuccess {string} prices.umnt umnt amount
   * @apiSuccess {string} prices.usdr usdr amount
   * @apiSuccess {string} prices.uusd uusd amount
   * @apiSuccess {String} taxRate Current tax rate
   * @apiSuccess {Object[]} taxCaps Current tax cap
   * @apiSuccess {string} taxCaps.denom denom name
   * @apiSuccess {string} taxCaps.taxCap tax cap amount
   * @apiSuccess {Object} issuances Total issuances of coins
   * @apiSuccess {string} issuances.ukrw ukrw amount
   * @apiSuccess {string} issuances.uluna uluna amount
   * @apiSuccess {string} issuances.umnt umnt amount
   * @apiSuccess {string} issuances.usdr usdr amount
   * @apiSuccess {string} issuances.uusd uusd amount
   * @apiSuccess {Object} stakingPool Current state of the staking pool
   * @apiSuccess {string} stakingPool.bondedTokens bonded token amount
   * @apiSuccess {string} stakingPool.notBondedTokens not bonded token amount
   * @apiSuccess {string} stakingPool.stakingRatio staking ratio
   * @apiSuccess {Object} communityPool Current state of the community pool
   * @apiSuccess {string} communityPool.ukrw ukrw amount
   * @apiSuccess {string} communityPool.uluna uluna amount
   * @apiSuccess {string} communityPool.umnt umnt amount
   * @apiSuccess {string} communityPool.usdr usdr amount
   * @apiSuccess {string} communityPool.uusd uusd amount
   */
  @Get('/')
  async getDashboard(ctx): Promise<void> {
    success(ctx, await getGeneralInfo())
  }

  /**
   * @api {get} /dashboard/tx_volume Get tx volume history
   * @apiName getTxVolume
   * @apiGroup Dashboard
   *
   * @apiSuccess {Object[]} cumulative
   * @apiSuccess {string} cumulative.denom denom name
   * @apiSuccess {Object[]} cumulative.data history data
   * @apiSuccess {number} cumulative.data.datetime unix time
   * @apiSuccess {string} cumulative.data.txVolume time wise cumulative tx volume
   *
   * @apiSuccess {Object[]} periodic
   * @apiSuccess {string} periodic.denom denom name
   * @apiSuccess {Object[]} periodic.data
   * @apiSuccess {number} periodic.data.datetime unix time
   * @apiSuccess {string} periodic.data.txVolume periodic tx volume
   */
  @Get('/tx_volume')
  async getTxVolume(ctx): Promise<void> {
    success(ctx, await getTransactionVol())
  }

  /**
   * @api {get} /dashboard/block_rewards Get block reward history
   * @apiName getBlockReward
   * @apiGroup Dashboard
   *
   * @apiSuccess {Object[]} cumulative cumulative history
   * @apiSuccess {Number} cumulative.datetime unix timestamp
   * @apiSuccess {Number} cumulative.blockReward cumulative reward
   *
   * @apiSuccess {Object[]} periodic periodic history
   * @apiSuccess {Number} periodic.datetime unix timestamp
   * @apiSuccess {Number} periodic.blockReward periodic reward on that timestamp
   */
  @Get('/block_rewards')
  async getBlockRewards(ctx): Promise<void> {
    success(ctx, await getBlockRewards())
  }

  /**
   * @api {get} /dashboard/seigniorage_proceeds Get the amount of seigniorage in the start of the day
   * @apiName getSeigniorageProc
   * @apiGroup Dashboard
   *
   * @apiSuccess {Object[]} seigniorage
   * @apiSuccess {Number} seigniorage.datetime unix time of history data
   * @apiSuccess {String} seigniorage.seigniorageProceeds amount of seigniorage on datetime
   */
  @Get('/seigniorage_proceeds')
  async getSeigniorageProc(ctx): Promise<void> {
    success(ctx, await getSeigniorageProceeds())
  }

  /**
   * @api {get} /dashboard/staking_return Get staking return history
   * @apiName getStakingReturn
   * @apiGroup Dashboard
   *
   * @apiSuccess {Object[]} seigniorage return history
   * @apiSuccess {Number} seigniorage.datetime unix timestamp
   * @apiSuccess {Number} seigniorage.dailyReturn daily return
   * @apiSuccess {Number} seigniorage.annualizedReturn annualized return
   *
   */
  @Get('/staking_return')
  async getStakingReturn(ctx): Promise<void> {
    success(ctx, await getStakingReturn())
  }

  /**
   * @api {get} /dashboard/staking_ratio Get the historical staking ratio
   * @apiName getStakingRatio
   * @apiGroup Dashboard

   * @apiSuccess {Object[]} stakingHistory
   * @apiSuccess {Number} stakingHistory.datetime unix timestamp
   * @apiSuccess {String} stakingHistory.stakingRatio staking ratio
   */
  @Get('/staking_ratio')
  async getStakingRatio(ctx): Promise<void> {
    success(ctx, await getStakingRatio())
  }

  /**
   * @api {get} /dashboard/account_growth Get account growth history
   * @apiName getAccountGrowth
   * @apiGroup Dashboard

   * @apiSuccess {Object[]} cumulative cumulative history data
   * @apiSuccess {Number} cumulative.datetime unix timestamp
   * @apiSuccess {Number} cumulative.totalAccount total account
   * @apiSuccess {Number} cumulative.activeAccount active account count
   *
   * @apiSuccess {Object[]} periodic periodic history
   * @apiSuccess {Number} periodic.datetime unix timestamp
   * @apiSuccess {Number} periodic.totalAccount total account on datetime
   * @apiSuccess {Number} periodic.activeAccount active account on datetime
   */
  @Get('/account_growth')
  async getAccountGrowth(ctx): Promise<void> {
    success(ctx, await getAccountGrowth())
  }
  /**
   * @api {get} /dashboard/active_accounts Get active accounts count history
   * @apiName getActiveAccounts
   * @apiGroup Dashboard

   * @apiSuccess {Number} total total active accounts in the time period
   * @apiSuccess {Object[]} periodic daily active account info's
   * @apiSuccess {Number} periodic.datetime unix timestamp
   * @apiSuccess {Number} periodic.value active account count
   */
  @Get('/active_accounts')
  async activeAccounts(ctx): Promise<void> {
    success(ctx, await getActiveAccounts())
  }

  /**
   * @api {get} /dashboard/registered_accounts Get registered accounts count history
   * @apiName getRegisteredAccounts
   * @apiGroup Dashboard
   *
   * @apiSuccess {Number} total total registered accounts in the time period
   * @apiSuccess {Object[]} periodic daily periodic account info's
   * @apiSuccess {Number} periodic.datetime unix timestamp
   * @apiSuccess {Number} periodic.value daily registered account count
   * @apiSuccess {Object[]} cumulative cumulative registered account count info's
   * @apiSuccess {Number} cumulative.datetime unix timestamp
   * @apiSuccess {Number} cumulative.value daily cumulative account count from genesis
   */
  @Get('/registered_accounts')
  async registeredAccounts(ctx): Promise<void> {
    success(ctx, await getRegisteredAccounts())
  }

  /**
   * @api {get} /dashboard/last_hour_ops_txs_count
   * @apiName getLastHourTxAndOpsCount
   * @apiGroup Dashboard
   *
   * @apiSuccess {Number} last_1h_op total ops count in last hour
   * @apiSuccess {Number} last_1h_tx total txs count in last hour
   */

  @Get('/last_hour_ops_txs_count')
  async lastHourOpsAndTxs(ctx): Promise<void> {
    success(ctx, await lastHourOpsAndTxs())
  }
}
