import * as memoizee from 'memoizee'
import { ProposalEntity } from 'orm'
import { format } from 'date-fns'

import * as lcd from 'lib/lcd'
import { getVoteSummary } from './voteSummary'
import { getAccountInfo } from './index'

export enum ProposalStatus {
  DEPOSIT = 'Deposit',
  VOTING = 'Voting',
  PASSED = 'Passed',
  REJECTED = 'Rejected',
  FAILED = 'Failed'
}

function renameStatus(status: string): string {
  if (status === 'VotingPeriod') {
    return 'Voting'
  }
  if (status === 'DepositPeriod') {
    return 'Deposit'
  }

  return status
}

export function getDepositInfo(
  proposal: LcdProposal,
  depositParams: LcdProposalDepositParams
): {
  depositEndTime: string
  totalDeposit: Coin[]
  minDeposit: Coin[]
} {
  const { total_deposit: totalDeposit, deposit_end_time: depositEndTime } = proposal
  const { min_deposit: minDeposit } = depositParams

  return {
    depositEndTime,
    totalDeposit,
    minDeposit
  }
}

function proposalTypeTranslator(proposalType: string): string {
  const typeToTypestr = {
    'gov/TextProposal': 'Text Proposal',
    'treasury/TaxRateUpdateProposal': 'Tax-rate Update',
    'treasury/RewardWeightUpdateProposal': 'Reward-weight Update',
    'distribution/CommunityPoolSpendProposal': 'Community-pool Spend',
    'params/ParameterChangeProposal': 'Parameter-change'
  }
  return typeToTypestr[proposalType] || proposalType
}

export const getProposalBasic = memoizee(getProposalBasicUncached, {
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
    proposer: await getAccountInfo(proposal.proposer),
    type: proposalTypeTranslator(proposal.type),
    status: renameStatus(proposal.status),
    submitTime: proposal.submitTime.toISOString(),
    title: proposal.title,
    description: proposal.content.value.description,
    deposit,
    vote
  }
}
