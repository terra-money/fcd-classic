import { KoaController, Validate, Get, Controller, Validator } from 'koa-joi-controllers'

import { success } from 'lib/response'
import { ErrorCodes } from 'lib/error'
import { TERRA_ACCOUNT_REGEX } from 'lib/constant'

import { getBalances } from 'service/bank'

const Joi = Validator.Joi

@Controller(`/bank`)
export default class BankController extends KoaController {
  /**
   * @api {get} /bank/:account Get account information
   * @apiName getBank
   * @apiGroup Bank
   *
   * @apiParam {string} account Account address in bech32 format
   *
   * @apiSuccess {Object[]} balance Available balance of the User
   * @apiSuccess {string} balance.denom Coin denomination
   * @apiSuccess {string} balance.amount Available amount
   * @apiSuccess {string} balance.delegatedVesting Delegated amount of the vesting amount
   * @apiSuccess {string} balance.delegatable Delegatable amount
   * @apiSuccess {string} balance.freedVesting Freed amount of the vesting amount
   * @apiSuccess {string} balance.unbonding Amount in unbonding state
   * @apiSuccess {string} balance.remainingVesting Amount not yet freed
   * @apiSuccess {Object[]} vesting Vesting schedule of the User
   * @apiSuccess {string} vesting.denom denom name
   * @apiSuccess {string} vesting.total vesting amount
   * @apiSuccess {Object[]} vesting.schedules vesting schedules of user
   * @apiSuccess {string} vesting.schedules.amount vesting amount
   * @apiSuccess {string} vesting.schedules.startTime vestring start time
   * @apiSuccess {string} vesting.schedules.endTime vesting end time
   * @apiSuccess {string} vesting.schedules.ratio vesting ratio
   * @apiSuccess {Object[]} delegations Delegation informations of the User
   * @apiSuccess {string} delegations.delegator_address delegator address
   * @apiSuccess {string} delegations.validator_address validator address
   * @apiSuccess {string} delegations.shares delegation share
   * @apiSuccess {string} delegations.amount delegation amount
   * @apiSuccess {Object[]} unbondings User unbonding details
   * @apiSuccess {string} unbondings.delegator_address delegator address
   * @apiSuccess {string} unbondings.validator_address validator address
   * @apiSuccess {Object[]} unbondings.entries details of unbondings
   * @apiSuccess {string} unbondings.entries.creating_height block height
   * @apiSuccess {string} unbondings.entries.completion_time unbonding completion time
   * @apiSuccess {string} unbondings.entries.initial_balance initial balancd
   * @apiSuccess {string} unbondings.entries.balance current balance
   */
  @Get('/:account')
  @Validate({
    params: {
      account: Joi.string().regex(TERRA_ACCOUNT_REGEX)
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getBalances(ctx) {
    success(ctx, await getBalances(ctx.params.account))
  }
}
