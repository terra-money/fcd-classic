import { ProposalEntity } from 'orm'

import memoizeCache from 'lib/memoizeCache'

import getAccountInfo from './getAccountInfo'

export enum ProposalStatus {
  DEPOSIT = 'Deposit',
  VOTING = 'Voting',
  PASSED = 'Passed',
  REJECTED = 'Rejected',
  FAILED = 'Failed'
}

export const STATUS_MAPPING = ['Nil', 'DepositPeriod', 'VotingPeriod', 'Passed', 'Rejected', 'Failed']

function transformStatus(status: string): string {
  if (status === 'VotingPeriod') {
    return 'Voting'
  }

  if (status === 'DepositPeriod') {
    return 'Deposit'
  }

  return status
}

function transformProposalType(proposalType: string): string {
  const typeToTypestr = {
    'gov/TextProposal': 'Text Proposal',
    'treasury/TaxRateUpdateProposal': 'Tax-rate Update',
    'treasury/RewardWeightUpdateProposal': 'Reward-weight Update',
    'distribution/CommunityPoolSpendProposal': 'Community-pool Spend',
    'params/ParameterChangeProposal': 'Parameter-change'
  }
  return typeToTypestr[proposalType] || proposalType
}

export const getProposalBasic = memoizeCache(getProposalBasicUncached, {
  promise: true,
  maxAge: 300 * 1000 /* 5 minutes */
})

async function getProposalBasicUncached(proposal: ProposalEntity): Promise<ProposalBasic> {
  // deposit
  const { depositEndTime, totalDeposit } = proposal
  const deposit: Deposit = {
    depositEndTime: depositEndTime.toISOString(),
    totalDeposit,
    minDeposit: proposal.depositParams.min_deposit
  }
  // proposal vote summary
  const { proposalId, voteDistribution, voteCount, stakedLuna, voters, totalVote, votingEndTime } = proposal
  const vote: VoteSummary = {
    id: proposalId,
    distribution: voteDistribution,
    count: voteCount,
    total: totalVote,
    votingEndTime: votingEndTime.toISOString(),
    stakedLuna,
    voters
  }

  return {
    id: proposalId,
    proposer: proposal.proposer ? await getAccountInfo(proposal.proposer) : undefined,
    type: transformProposalType(proposal.type),
    status: transformStatus(proposal.status),
    submitTime: proposal.submitTime.toISOString(),
    title: proposal.title,
    description: proposal.content.value.description,
    deposit,
    vote
  }
}
