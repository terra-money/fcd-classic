import * as lcd from 'lib/lcd'
import { errorReport } from 'lib/errorReporting'
import { getVoteSummary } from './voteSummary'
import { getAccountInfo } from './index'
import * as memoizee from 'memoizee'

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

export async function getProposalBasicUncached(
  proposal: LcdProposal,
  depositParams: LcdProposalDepositParams,
  isSummary = false
): Promise<ProposalBasic> {
  const proposer = await lcd.getProposalProposer(proposal.id)
  const { id, content, submit_time: submitTime, proposal_status: status } = proposal

  const renamedStatus = renameStatus(status)

  const { type, value: contentValues } = content
  const { title, description } = contentValues

  let voteSummary

  if (renamedStatus !== 'Rejected' || !isSummary) {
    voteSummary = await getVoteSummary(proposal)
  }

  const proposerInfo = await getAccountInfo(proposer.proposer)
  const result = {
    id,
    proposer: proposerInfo,
    type: proposalTypeTranslator(type),
    status: renamedStatus,
    submitTime,
    title,
    description,
    deposit: getDepositInfo(proposal, depositParams),
    vote: voteSummary
  }

  return result
}

export const getProposalBasic = memoizee(getProposalBasicUncached, {
  promise: true,
  maxAge: 300 * 1000 /* 5 minutes */
})
