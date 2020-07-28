import 'koa-body'
import { KoaController, Validate, Get, Controller, Validator } from 'koa-joi-controllers'

import { success } from 'lib/response'
import { ErrorCodes } from 'lib/error'
import { TERRA_ACCOUNT_REGEX } from 'lib/constant'

import { getProposals, getProposal, getVotes, getDeposits, ProposalStatus, VoteTypes } from 'service/governance'

const Joi = Validator.Joi

const CONTROLLER_ID = 'gov'

@Controller(`/${CONTROLLER_ID}`)
class GovernanceController extends KoaController {
  /**
   * @api {get} /gov/proposals Get proposal list
   * @apiName getProposallist
   * @apiGroup Governance
   *
   * @apiParam {string} [status] 'deposit', 'voting', 'passed', 'rejected'
   *
   * @apiSuccess {Object[]} minDeposit Minimum deposit minimun proposal deposit
   * @apiSuccess {string} minDeposit.denom denom name
   * @apiSuccess {string} minDeposit.amount amount
   * @apiSuccess {string} maxDepositPeriod Deposit period
   * @apiSuccess {string} votingPeriod
   * @apiSuccess {Object[]} proposals
   * @apiSuccess {string} proposals.id
   * @apiSuccess {Object} proposals.proposer Proposer information
   * @apiSuccess {string} proposals.proposer.accountAddress Proposer address
   * @apiSuccess {string} proposals.proposer.moniker Proposer moniker
   * @apiSuccess {string} proposals.type Proposal type
   * @apiSuccess {string} proposals.status Proposal status
   * @apiSuccess {string} proposals.submitTime
   * @apiSuccess {string} proposals.title
   * @apiSuccess {string} proposals.description
   * @apiSuccess {Object} proposals.deposit
   * @apiSuccess {string} proposals.deposit.depositEndTime
   * @apiSuccess {Object[]} proposals.deposit.totalDeposit
   * @apiSuccess {string} proposals.deposit.totalDeposit.depositEndTime
   * @apiSuccess {Object} proposals.vote
   * @apiSuccess {string} proposals.vote.id
   * @apiSuccess {object} proposals.vote.distribution Distribution of vote
   * @apiSuccess {string} proposals.vote.distribution.Yes vote amount
   * @apiSuccess {string} proposals.vote.distribution.No vote amount
   * @apiSuccess {string} proposals.vote.distribution.NoWithVeto vote amount
   * @apiSuccess {string} proposals.vote.distribution.Abstain vote amount
   * @apiSuccess {object} proposals.vote.count
   * @apiSuccess {string} proposals.vote.count.Yes vote count
   * @apiSuccess {string} proposals.vote.count.No vote count
   * @apiSuccess {string} proposals.vote.count.NoWithVeto vote count
   * @apiSuccess {string} proposals.vote.count.Abstain vote count
   * @apiSuccess {string} proposals.vote.total Total voted luna
   * @apiSuccess {string} proposals.vote.votingEndTime
   * @apiSuccess {string} proposals.vote.stakedLuna Total staked luna
   */

  @Get('/proposals')
  @Validate({
    query: {
      status: Joi.string()
        .valid(['', Object.values(ProposalStatus)])
        .description('Proposal status')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getProposals(ctx): Promise<void> {
    const { status } = ctx.request.query
    success(ctx, await getProposals(status))
  }

  /**
   * @api {get} /gov/proposals/:proposalId Get proposal
   * @apiName getProposal
   * @apiGroup Governance
   *
   * @apiParam {string} proposalId Proposal id
   * @apiParam {string} [account] User account
   *
   * @apiSuccess {string} id
   * @apiSuccess {Object} proposer Proposer information
   * @apiSuccess {string} proposer.accountAddress Proposer information
   * @apiSuccess {string} [proposer.moniker] Proposer information
   * @apiSuccess {string} [proposer.operatorAddress] Proposer information
   * @apiSuccess {string} type Proposal type
   * @apiSuccess {string} status Proposal status
   * @apiSuccess {string} submitTime
   * @apiSuccess {string} title
   * @apiSuccess {string} description
   * @apiSuccess {Object} deposit
   * @apiSuccess {string} deposit.depositEndTime
   * @apiSuccess {Object[]} deposit.totalDeposit total deposit info
   * @apiSuccess {string} deposit.totalDeposit.denom denom name
   * @apiSuccess {string} deposit.totalDeposit.amount denom amount
   * @apiSuccess {Object[]} deposit.minDeposit Minimum deposit
   * @apiSuccess {string} deposit.minDeposit.denom Minimum deposit demon
   * @apiSuccess {string} deposit.minDeposit.amount Minimum deposit amount
   * @apiSuccess {Object} vote
   * @apiSuccess {string} vote.id
   * @apiSuccess {object} vote.distribution Distribution of vote
   * @apiSuccess {string} vote.distribution.Yes vote amount
   * @apiSuccess {string} vote.distribution.No vote amount
   * @apiSuccess {string} vote.distribution.NoWithVeto vote amount
   * @apiSuccess {string} vote.distribution.Abstain vote amount
   * @apiSuccess {object} vote.count
   * @apiSuccess {string} vote.count.Yes vote count
   * @apiSuccess {string} vote.count.No vote count
   * @apiSuccess {string} vote.count.NoWithVeto vote count
   * @apiSuccess {string} vote.count.Abstain vote count
   * @apiSuccess {string} vote.total Total voted luna
   * @apiSuccess {string} vote.votingEndTime
   * @apiSuccess {string} vote.stakedLuna Total staked luna
   * @apiSuccess {Object[]} validatorsNotVoted
   * @apiSuccess {string} validatorsNotVoted.operatorAddress
   * @apiSuccess {string} validatorsNotVoted.consensusPubKey
   * @apiSuccess {object} validatorsNotVoted.description
   * @apiSuccess {string} validatorsNotVoted.description.moniker
   * @apiSuccess {string} validatorsNotVoted.description.identity
   * @apiSuccess {string} validatorsNotVoted.description.website
   * @apiSuccess {string} validatorsNotVoted.description.details
   * @apiSuccess {string} validatorsNotVoted.description.profileIcon
   *
   */
  @Get('/proposals/:proposalId')
  @Validate({
    params: {
      proposalId: Joi.number().min(1).required().description('Proposal id')
    },
    query: {
      account: Joi.string().allow('').regex(TERRA_ACCOUNT_REGEX).description('User account')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getIndividualProposal(ctx): Promise<void> {
    const { proposalId } = ctx.params
    const { account } = ctx.request.query
    success(ctx, await getProposal(proposalId, account))
  }

  /**
   * @api {get} /gov/proposals/:proposalId/deposits Get proposal's deposits
   * @apiName getProposalDeposits
   * @apiGroup Governance
   *
   * @apiParam {string} proposalId Proposal id
   * @apiParam {number} [page=1] Page number
   * @apiParam {number} [limit=5] Page size
   *
   * @apiSuccess {number} totalCnt
   * @apiSuccess {number} page
   * @apiSuccess {number} limit
   * @apiSuccess {Object[]} deposits Deposit list
   * @apiSuccess {string} deposits.txhash Txhash of the deposit transaction
   *
   * @apiSuccess {Object[]} deposits.deposit
   * @apiSuccess {string} deposits.deposit.amount Deposit amount
   * @apiSuccess {string} deposits.deposit.denom Deposit denomination
   *
   * @apiSuccess {Object[]} deposits.depositor Depositor information
   * @apiSuccess {string} deposits.depositor.accountAddress
   * @apiSuccess {string} deposits.depositor.operatorAddress
   * @apiSuccess {string} deposits.depositor.moniker
   */
  @Get('/proposals/:proposalId/deposits')
  @Validate({
    params: {
      proposalId: Joi.number().min(1).required().description('Proposal id')
    },
    query: {
      page: Joi.number().min(1).default(1).description('Page number'),
      limit: Joi.number().min(1).default(5).description('Item count per page')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getProposalDeposits(ctx): Promise<void> {
    const { proposalId } = ctx.params
    const page = +ctx.request.query.page
    const limit = +ctx.request.query.limit

    success(
      ctx,
      await getDeposits({
        proposalId,
        page,
        limit
      })
    )
  }

  /**
   * @api {get} /gov/proposals/:proposalId/votes Get proposal's votes
   * @apiName getProposalVotes
   * @apiGroup Governance
   *
   * @apiParam {string} proposalId Proposal id
   * @apiParam {number} [page=1] Page number
   * @apiParam {number} [limit=5] Page size
   * @apiParam {string} [option] 'Yes', 'No', 'NoWithVeto', 'Abstain'
   *
   * @apiSuccess {number} totalCnt
   * @apiSuccess {number} page
   * @apiSuccess {number} limit
   * @apiSuccess {Object[]} votes Vote list
   * @apiSuccess {string} votes.txhash Txhash of the vote transaction
   * @apiSuccess {string} votes.answer 'Yes', 'No', 'NoWithVeto', 'Abstain'
   * @apiSuccess {Object[]} votes.voter Voter information
   * @apiSuccess {string} votes.voter.accountAddress
   * @apiSuccess {string} votes.voter.operatorAddress
   * @apiSuccess {string} votes.voter.moniker
   */
  @Get('/proposals/:proposalId/votes')
  @Validate({
    params: {
      proposalId: Joi.number().min(1).required().description('Proposal id')
    },
    query: {
      page: Joi.number().min(1).default(1).description('Page number'),
      limit: Joi.number().min(1).default(5).description('Item count per page'),
      option: Joi.string()
        .valid(['', Object.values(VoteTypes)])
        .description('Votes types')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getProposalVotes(ctx): Promise<void> {
    const { proposalId } = ctx.params
    const page = ctx.request.query.page
    const limit = ctx.request.query.limit
    const { option } = ctx.request.query

    success(
      ctx,
      await getVotes({
        proposalId,
        page,
        limit,
        option
      })
    )
  }
}

export default GovernanceController
