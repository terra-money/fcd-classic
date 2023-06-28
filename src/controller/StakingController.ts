import 'koa-body'
import { KoaController, Validate, Get, Controller, Validator } from 'koa-joi-controllers'

import { success } from 'lib/response'
import { ErrorCodes } from 'lib/error'
import { TERRA_OPERATOR_ADD_REGEX, TERRA_ACCOUNT_REGEX, MOVING_AVG_WINDOW_IN_DAYS } from 'lib/constant'
import { daysBeforeTs } from 'lib/time'
import {
  getStakingForAccount,
  getValidators,
  getValidatorDetail,
  getClaims,
  getValidatorReturn,
  getTotalStakingReturn
} from 'service/staking'

const Joi = Validator.Joi

@Controller(`/staking`)
export default class StakingController extends KoaController {
  /**
   * @api {get} /staking/validators/:operatorAddr Get validator detail
   * @apiName getValidatorDetail
   * @apiGroup Staking
   *
   * @apiParam {string} operatorAddr Operator address
   * @apiParam {string} [account] User address
   *
   * @apiSuccess {string} operatorAddress
   * @apiSuccess {string} consensusPubkey
   * @apiSuccess {Object} description
   * @apiSuccess {string} description.moniker
   * @apiSuccess {string} description.identity
   * @apiSuccess {string} description.website
   * @apiSuccess {string} description.details
   * @apiSuccess {string} description.profileIcon
   * @apiSuccess {string} tokens
   * @apiSuccess {string} delegatorShares
   * @apiSuccess {Object} votingPower
   * @apiSuccess {string} votingPower.amount string int format
   * @apiSuccess {string} votingPower.weight bit int
   * @apiSuccess {Object} commissionInfo
   * @apiSuccess {string} commissionInfo.rate
   * @apiSuccess {string} commissionInfo.maxRate
   * @apiSuccess {string} commissionInfo.maxChangeRate
   * @apiSuccess {string} commissionInfo.updateTime
   * @apiSuccess {number} upTime
   * @apiSuccess {string} status
   * @apiSuccess {Object} rewardsPool
   * @apiSuccess {string} rewardsPool.total
   * @apiSuccess {Object[]} rewardsPool.denoms {denom: string, amount: string} format
   * @apiSuccess {string} rewardsPool.denoms.denom
   * @apiSuccess {string} rewardsPool.denoms.amount
   * @apiSuccess {string} stakingReturn
   * @apiSuccess {string} accountAddress
   * @apiSuccess {Object} selfDelegation
   * @apiSuccess {string} selfDelegation.amount
   * @apiSuccess {string} selfDelegation.weight
   * @apiSuccess {string} myDelegation total delegation amount
   * @apiSuccess {Object[]} myUndelegation user undelegations
   * @apiSuccess {string} myUndelegation.releaseTime undelegation release date time
   * @apiSuccess {string} myUndelegation.amount undelegation amount
   * @apiSuccess {string} myUndelegation.validatorName validator name
   * @apiSuccess {string} myUndelegation.validatorAddress validator address
   * @apiSuccess {string} myUndelegation.creationHeight block height
   * @apiSuccess {string} myDelegatable delegateable amount
   * @apiSuccess {Object} myRewards
   * @apiSuccess {string} myRewards.total total reward
   * @apiSuccess {Object[]} myRewards.denoms reward by denoms list
   * @apiSuccess {string} myRewards.denoms.denom denom name
   * @apiSuccess {string} myRewards.denoms.amount reward amount
   * @apiSuccess {string} myRewards.denoms.adjustedAmount reward amount adjusted by luna price
   */
  @Get('/validators/:operatorAddr')
  @Validate({
    params: {
      operatorAddr: Joi.string().required().regex(TERRA_OPERATOR_ADD_REGEX).description('Operator address')
    },
    query: {
      account: Joi.string().allow('').regex(TERRA_ACCOUNT_REGEX).description('User account address')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getValidator(ctx): Promise<void> {
    success(ctx, await getValidatorDetail(ctx.params.operatorAddr, ctx.request.query.account))
  }

  /**
   * @api {get} /staking/validators/:operatorAddr/claims Get validators claims
   * @apiName getValidatorClaims
   * @apiGroup Staking
   *
   * @apiParam {string} operatorAddr validators operator address
   * @apiParam {number} [page=1] Page number
   * @apiParam {number} [limit=5] Page size
   *
   * @apiSuccess {number} page
   * @apiSuccess {number} limit
   * @apiSuccess {Object[]} claims Claim list
   * @apiSuccess {string} claims.chainId
   * @apiSuccess {string} claims.txhash Tx hash
   * @apiSuccess {string} claims.type Claim type
   * @apiSuccess {Object[]} claims.amount
   * @apiSuccess {string} claims.amount.denom
   * @apiSuccess {string} claims.amount.amount
   * @apiSuccess {string} claims.timestamp Tx timestamp
   */
  @Get('/validators/:operatorAddr/claims')
  @Validate({
    params: {
      operatorAddr: Joi.string().required().regex(TERRA_OPERATOR_ADD_REGEX).description('Operator address')
    },
    query: {
      limit: Joi.number().default(5).valid(5, 100).description('Items per page'),
      offset: Joi.number().description('Offset')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async claims(ctx): Promise<void> {
    success(
      ctx,
      await getClaims({
        ...ctx.params,
        ...ctx.request.query
      })
    )
  }

  /**
   * @api {get} /staking/validators Get all validator info
   * @apiName getValidators
   * @apiGroup Staking
   *
   * @apiSuccess {Object[]} validator
   * @apiSuccess {string} validator.operatorAddress
   * @apiSuccess {string} validator.consensusPubkey
   * @apiSuccess {Object} validator.description
   * @apiSuccess {string} validator.description.moniker
   * @apiSuccess {string} validator.description.identity
   * @apiSuccess {string} validator.description.website
   * @apiSuccess {string} validator.description.details
   * @apiSuccess {string} validator.description.profileIcon
   * @apiSuccess {string} validator.tokens
   * @apiSuccess {string} validator.delegatorShares
   * @apiSuccess {Object} validator.votingPower
   * @apiSuccess {string} validator.votingPower.amount
   * @apiSuccess {string} validator.votingPower.weight
   * @apiSuccess {Object} validator.commissionInfo
   * @apiSuccess {string} validator.commissionInfo.rate
   * @apiSuccess {string} validator.commissionInfo.maxRate
   * @apiSuccess {string} validator.commissionInfo.maxChangeRate
   * @apiSuccess {string} validator.commissionInfo.updateTime
   * @apiSuccess {number} validator.upTime
   * @apiSuccess {string} validator.status
   * @apiSuccess {Object} validator.rewardsPool
   * @apiSuccess {string} validator.rewardsPool.total
   * @apiSuccess {Object[]} validator.rewardsPool.denoms {denom: string, amount: string} format
   * @apiSuccess {string} validator.rewardsPool.denoms.denom
   * @apiSuccess {string} validator.rewardsPool.denoms.amount
   * @apiSuccess {string} validator.stakingReturn
   * @apiSuccess {string} validator.accountAddress
   * @apiSuccess {Object} validator.selfDelegation
   * @apiSuccess {string} validator.selfDelegation.amount
   * @apiSuccess {string} validator.selfDelegation.weight
   */
  @Get('/validators')
  async validators(ctx) {
    success(ctx, await getValidators())
  }

  /**
   * @api {get} /staking/:account Get all validators and staking info with account
   * @apiName getStakingForAccount
   * @apiGroup Staking
   *
   * @apiParam {string} account User's account address
   *
   * @apiSuccess {string} delegationTotal Amount staked by user
   * @apiSuccess {string} availableLuna Users total luna amount
   * @apiSuccess {Object[]} undelegations Undelegation information in progress by user
   * @apiSuccess {string} undelegations.amount Undelegation amount
   * @apiSuccess {string} undelegations.creationHeight Undelegation creation block height
   * @apiSuccess {string} undelegations.releaseTime Amount release time
   * @apiSuccess {string} undelegations.validatorAddress Validator address
   * @apiSuccess {string} undelegations.validatorName Validators name
   * @apiSuccess {string} undelegations.validatorStatus Validator status
   *
   * @apiSuccess {Object[]} myDelegations Users delegations list
   * @apiSuccess {string} myDelegations.amountDelegated Users delegations list
   * @apiSuccess {string} myDelegations.totalReward Users delegations list
   * @apiSuccess {string} myDelegations.validatorAddress Users delegations list
   * @apiSuccess {string} myDelegations.validatorName Users delegations list
   *
   *
   * @apiSuccess {Object} rewards User's reward info
   * @apiSuccess {string} rewards.total User's total reward
   * @apiSuccess {Object[]} rewards.denoms User's reward by denoms
   * @apiSuccess {string} rewards.denoms.denom reward denom
   * @apiSuccess {string} rewards.denoms.amount reward amount
   *
   * @apiSuccess {Object[]} validators
   * @apiSuccess {string} validators.operatorAddress
   * @apiSuccess {string} validators.consensusPubkey
   * @apiSuccess {Object} validators.description
   * @apiSuccess {string} validators.description.moniker
   * @apiSuccess {string} validators.description.identity
   * @apiSuccess {string} validators.description.website
   * @apiSuccess {string} validators.description.details
   * @apiSuccess {string} validators.description.profileIcon
   * @apiSuccess {string} validators.tokens
   * @apiSuccess {string} validators.delegatorShares
   * @apiSuccess {Object} validators.votingPower
   * @apiSuccess {string} validators.votingPower.amount
   * @apiSuccess {string} validators.votingPower.weight
   * @apiSuccess {Object} validators.commissionInfo
   * @apiSuccess {string} validators.commissionInfo.rate
   * @apiSuccess {string} validators.commissionInfo.maxRate
   * @apiSuccess {string} validators.commissionInfo.maxChangeRate
   * @apiSuccess {string} validators.commissionInfo.updateTime
   * @apiSuccess {number} validators.upTime
   * @apiSuccess {string} validators.status
   * @apiSuccess {Object} validators.rewardsPool
   * @apiSuccess {string} validators.rewardsPool.total
   * @apiSuccess {Object[]} validators.rewardsPool.denoms
   * @apiSuccess {string} validators.rewardsPool.denoms.denom
   * @apiSuccess {string} validators.rewardsPool.denoms.amount
   * @apiSuccess {string} validators.stakingReturn
   * @apiSuccess {string} validators.myDelegation The amount of user delegation to this validator
   * @apiSuccess {string} validators.myUndelegation Undelegation information of user in progress in this validator
   */
  @Get('/account/:account')
  @Validate({
    params: {
      account: Joi.string().required().regex(TERRA_ACCOUNT_REGEX).description('User account')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getStakingForAccount(ctx): Promise<void> {
    success(ctx, await getStakingForAccount(ctx.params.account))
  }

  /**
   * @api {get} /staking/return Get total staking return
   * @apiName getStakingReturn
   * @apiGroup Staking
   *
   * @apiSuccess {number} - Annualized staking return
   *
   */
  @Get('/return')
  async getTotalStakingReturn(ctx): Promise<void> {
    const { fromTs, toTs } = daysBeforeTs(MOVING_AVG_WINDOW_IN_DAYS)
    success(ctx, await getTotalStakingReturn(fromTs, toTs))
  }

  /**
   * @api {get} /staking/return/:operatorAddr Get validators staking return
   * @apiName getValidatorStakingReturn
   * @apiGroup Staking
   *
   * @apiParam {string} operatorAddr validators operator address
   *
   * @apiSuccess {number} - Annualized staking return
   *
   */
  @Get('/return/:operatorAddr')
  @Validate({
    params: {
      operatorAddr: Joi.string().required().regex(TERRA_OPERATOR_ADD_REGEX).description('Operator address')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getStakingReturnOfValidator(ctx): Promise<void> {
    const result = await getValidatorReturn(ctx.params.operatorAddr)
    success(ctx, result[ctx.params.operatorAddr] ? result[ctx.params.operatorAddr].stakingReturn : '0')
  }
}
