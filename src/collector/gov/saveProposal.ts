import { EntityManager, DeepPartial } from 'typeorm'
import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { ProposalEntity } from 'orm'
import config from 'config'
import { STATUS_MAPPING, getVoteSummary } from 'service/governance/helper'

function shouldUpdateProposal(status: string): boolean {
  if (status === 'VotingPeriod' || status === 'DepositPeriod') {
    return true
  }

  return false
}

export async function saveProposalDetails(
  mgr: EntityManager,
  proposal: LcdProposal,
  proposalTallyingParams: LcdProposalTallyingParams,
  proposalDepositParams: LcdProposalDepositParams,
  validatorsVotingPower
) {
  const cachedProposal = await mgr.findOne(ProposalEntity, {
    proposalId: proposal.id
  })

  if (cachedProposal && !shouldUpdateProposal(cachedProposal.status)) {
    return
  }

  // get proposer info
  const [proposer, deposits, votes] = await Promise.all([
    lcd.getProposalProposer(proposal.id),
    lcd.getProposalDeposits(proposal.id),
    lcd.getProposalVotes(proposal.id)
  ])

  const voteSummary = await getVoteSummary(proposal, votes, validatorsVotingPower)

  if (!voteSummary) {
    throw new Error(`Failed to get proposal ${proposal.id} vote summary`)
  }

  let content: Content

  // Columbus-5 compatibility for unknown types
  if ('type' in proposal.content) {
    content = proposal.content
  } else {
    const pp = await lcd.getProposalProto('775')

    content = {
      type: lcd.convertProtoType(pp.content['@type']),
      value: pp.content
    }
  }

  const proposalEntityObject: DeepPartial<ProposalEntity> = {
    id: cachedProposal ? cachedProposal.id : 0,
    proposalId: proposal.id,
    chainId: config.CHAIN_ID,
    title: content.value.title,
    type: content.type,
    status: STATUS_MAPPING[proposal.status],
    submitTime: proposal.submit_time,
    depositEndTime: proposal.deposit_end_time,
    votingStartTime: proposal.voting_start_time,
    votingEndTime: proposal.voting_end_time,
    totalVote: voteSummary.total,
    stakedLuna: voteSummary.stakedLuna,
    content,
    voteDistribution: voteSummary.distribution,
    voteCount: voteSummary.count,
    voters: voteSummary.voters,
    tallyingParameters: proposalTallyingParams,
    depositParams: proposalDepositParams,
    totalDeposit: proposal.total_deposit,
    ...(deposits && { deposits }),
    ...(votes && { votes }),
    ...(proposer && { proposer: proposer.proposer })
  }

  await mgr.save(ProposalEntity, proposalEntityObject)
  logger.info(`Saved proposal ${proposal.id}`)
}
