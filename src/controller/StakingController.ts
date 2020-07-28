import 'koa-body'
import { KoaController, Validate, Get, Controller, Validator } from 'koa-joi-controllers'

import { controllerExporter } from 'lib/controllerExporter'
import { success } from 'lib/response'
import { ErrorCodes } from 'lib/error'
import { TERRA_OPERATOR_ADD_REGEX, TERRA_ACCOUNT_REGEX, MOVING_AVG_WINDOW_IN_DAYS } from 'lib/constant'
import { daysBeforeTs } from 'lib/time'
import { apiLogger as logger } from 'lib/logger'

import {
  getStaking,
  getValidators,
  getValidatorDetail,
  getDelegationTxs,
  getClaims,
  getDelegators,
  getValidatorAnnualAvgReturn,
  getTotalStakingReturn
} from 'service/staking'

const Joi = Validator.Joi

const CONTROLLER_ID = 'staking'

@Controller(`/${CONTROLLER_ID}`)
class StakingController extends KoaController {
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
    const { operatorAddr } = ctx.params
    const { account } = ctx.request.query

    success(ctx, await getValidatorDetail(operatorAddr, account))
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
   * @api {get} /staking/validators/:operatorAddr/delegations Get validator's delegations
   * @apiName getValidatorDelegations
   * @apiGroup Staking
   *
   * @apiParam {string} operatorAddr validator's operator address
   * @apiParam {number} [page=1] Page number
   * @apiParam {number} [limit=5] Page size
   *
   * @apiSuccess {number} totalCnt
   * @apiSuccess {number} page
   * @apiSuccess {number} limit
   * @apiSuccess {Object[]} events Delegation event list
   * @apiSuccess {string} events.height The height of the block the event was performed
   * @apiSuccess {string} events.type Event type
   * @apiSuccess {Object[]} events.amount
   * @apiSuccess {string} events.amount.denom
   * @apiSuccess {string} events.amount.amount
   * @apiSuccess {string} events.timestamp
   *
   */
  @Get('/validators/:operatorAddr/delegations')
  @Validate({
    params: {
      operatorAddr: Joi.string().required().regex(TERRA_OPERATOR_ADD_REGEX).description('Operator address')
    },
    query: {
      page: Joi.number().default(1).min(1).description('Page number'),
      limit: Joi.number().default(5).min(1).description('Items per page')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getDelegationEvents(ctx): Promise<void> {
    const { operatorAddr } = ctx.params
    const page = +ctx.request.query.page
    const limit = +ctx.request.query.limit

    success(
      ctx,
      await getDelegationTxs({
        operatorAddr,
        page,
        limit
      })
    )
  }

  /**
   * @api {get} /staking/validators/:operatorAddr/claims Get validator's claims
   * @apiName getValidatorClaims
   * @apiGroup Staking
   *
   * @apiParam {string} operatorAddr validator's operator address
   * @apiParam {number} [page=1] Page number
   * @apiParam {number} [limit=5] Page size
   *
   * @apiSuccess {number} totalCnt
   * @apiSuccess {number} page
   * @apiSuccess {number} limit
   * @apiSuccess {Object[]} claims Claim list
   * @apiSuccess {string} claims.timestamp Tx timestamp
   * @apiSuccess {string} claims.tx Tx hash
   * @apiSuccess {string} claims.type Claim type
   * @apiSuccess {Object[]} claims.amount
   * @apiSuccess {string} claims.amount.denom
   * @apiSuccess {string} claims.amount.amount
   */
  @Get('/validators/:operatorAddr/claims')
  @Validate({
    params: {
      operatorAddr: Joi.string().required().regex(TERRA_OPERATOR_ADD_REGEX).description('Operator address')
    },
    query: {
      page: Joi.number().default(1).min(1).description('Page number'),
      limit: Joi.number().default(5).min(1).description('Items per page')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async claims(ctx): Promise<void> {
    const { operatorAddr } = ctx.params
    const page = +ctx.request.query.page
    const limit = +ctx.request.query.limit

    success(
      ctx,
      await getClaims({
        operatorAddr,
        page,
        limit
      })
    )
  }

  /**
   * @api {get} /staking/validators/:operatorAddr/delegators Get validator's delegators
   * @apiName getValidatorDelegators
   * @apiGroup Staking
   *
   * @apiParam {string} operatorAddr validator's operator address
   * @apiParam {number} [page=1] Page number
   * @apiParam {number} [limit=5] Page size
   *
   * @apiSuccess {number} totalCnt
   * @apiSuccess {number} page
   * @apiSuccess {number} limit
   * @apiSuccess {Object[]} delegator Delegator list
   * @apiSuccess {string} delegator.address Delegator address
   * @apiSuccess {string} delegator.amount Amount of luna delegated
   * @apiSuccess {string} delegator.weight
   *
   */
  @Get('/validators/:operatorAddr/delegators')
  @Validate({
    params: {
      operatorAddr: Joi.string().required().regex(TERRA_OPERATOR_ADD_REGEX).description('Operator address')
    },
    query: {
      page: Joi.number().default(1).min(1).description('Page number'),
      limit: Joi.number().default(5).min(1).description('Items per page')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async delegators(ctx): Promise<void> {
    const { operatorAddr } = ctx.params
    const page = +ctx.request.query.page
    const limit = +ctx.request.query.limit
    success(
      ctx,
      await getDelegators({
        operatorAddr,
        page,
        limit
      })
    )
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
  @Get('/:account')
  @Validate({
    params: {
      account: Joi.string().required().regex(TERRA_ACCOUNT_REGEX).description('User account')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getStakingForAccount(ctx): Promise<void> {
    const { account } = ctx.params

    success(ctx, await getStaking(account))
  }

  /**
   * @api {get} /staking Get all validators and staking info
   * @apiName getStaking
   * @apiGroup Staking
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
  @Get('/')
  async getStakingForAll(ctx): Promise<void> {
    success(ctx, {
      validators: await getValidators()
    })
  }

  /**
   * @api {get} /staking/return/:operatorAddr Get validator's staking return
   * @apiName getValidatorStakingReturn
   * @apiGroup Staking
   *
   * @apiParam {string} operatorAddr validator's operator address
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
    const { operatorAddr } = ctx.params
    const { stakingReturn } = await getValidatorAnnualAvgReturn(operatorAddr)
    success(ctx, stakingReturn)
  }
}

export default controllerExporter(CONTROLLER_ID, StakingController, logger)
