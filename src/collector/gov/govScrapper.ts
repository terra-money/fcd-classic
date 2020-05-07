import * as lcd from 'lib/lcd'
import { vsLogger as logger } from 'lib/logger'
import { ProposalEntity } from 'orm'

import { getRepository, DeepPartial } from 'typeorm'
import config from 'config'
import { getVoteSummary } from 'service/governance/helper'

function shouldUpdateProposal(status: string): boolean {
  if (status === 'VotingPeriod' || status === 'DepositPeriod') {
    return true
  }
  return false
}

async function saveProposalDetails(
  proposal: LcdProposal,
  proposalTallyingParams: LcdProposalTallyingParams,
  proposalDepositParams: LcdProposalDepositParams
) {
  const cachedProposal = await getRepository(ProposalEntity).findOne({
    proposalId: proposal.id,
    chainId: config.CHAIN_ID
  })

  if (cachedProposal && !shouldUpdateProposal(cachedProposal.status)) {
    logger.info(`Proposal ${proposal.id} already exists do not need updates`)
    return
  }

  // get proposer info
  const proposer = await lcd.getProposalProposer(proposal.id)

  const voteSummary = await getVoteSummary(proposal)

  if (!voteSummary) {
    throw new Error(`Failed to get proposal ${proposal.id} vote summary`)
  }

  const proposalDepositTxs = await lcd.getProposalDeposits(proposal.id)
  const proposalVoteTxs = await lcd.getProposalVoteTxs(proposal.id)

  const proposalEntityObject: DeepPartial<ProposalEntity> = {
    proposalId: proposal.id,
    chainId: config.CHAIN_ID,
    proposer: proposer.proposer,
    title: proposal.content.value.title,
    type: proposal.content.type,
    status: proposal.proposal_status,
    submitTime: proposal.submit_time,
    depositEndTime: proposal.deposit_end_time,
    votingStartTime: proposal.voting_start_time,
    votingEndTime: proposal.voting_end_time,
    totalVote: voteSummary.total,
    stakedLuna: voteSummary.stakedLuna,
    content: proposal.content,
    voteDistribution: voteSummary.distribution,
    voteCount: voteSummary.count,
    voters: voteSummary.voters,
    tallyingParameters: proposalTallyingParams,
    depositParams: proposalDepositParams,
    totalDeposit: proposal.total_deposit,
    depositTxs: proposalDepositTxs,
    voteTxs: proposalVoteTxs
  }

  if (!cachedProposal) {
    logger.info(`Saving proposal ${proposal.id}`)
    await getRepository(ProposalEntity).save(proposalEntityObject)
  } else {
    logger.info(`Updating proposal ${proposal.id}`)
    await getRepository(ProposalEntity).update(cachedProposal.id, proposalEntityObject)
  }
}

export async function scrapeAndSaveProposalsInfo() {
  logger.info(`Starting proposal scrapper`)
  const proposals: LcdProposal[] = await lcd.getProposals()
  const proposalTallyingParams = await lcd.getProposalTallyingParams()
  const proposalDepositParams = await lcd.getProposalDepositParams()
  logger.info(`Got a list of ${proposals.length} proposals`)
  for (const proposal of proposals) {
    try {
      logger.info(`Saving proposal ${proposal.id}`)
      await saveProposalDetails(proposal, proposalTallyingParams, proposalDepositParams)
    } catch (error) {
      logger.error(`Failed to save proposal ${proposal.id}`)
      logger.error(error)
    }
  }
  return
}
