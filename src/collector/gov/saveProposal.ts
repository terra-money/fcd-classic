import * as sentry from '@sentry/node'
import { getManager, EntityManager, DeepPartial } from 'typeorm'

import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'

import { ProposalEntity } from 'orm'
import config from 'config'

import { getVoteSummary } from 'service/governance/helper'

function shouldUpdateProposal(status: string): boolean {
  if (status === 'VotingPeriod' || status === 'DepositPeriod') {
    return true
  }

  return false
}

export async function saveProposalDetails(
  proposal: LcdProposal,
  proposalTallyingParams: LcdProposalTallyingParams,
  proposalDepositParams: LcdProposalDepositParams,
  validatorsVotingPower
) {
  return getManager()
    .transaction(async (mgr: EntityManager) => {
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

      const proposalEntityObject: DeepPartial<ProposalEntity> = {
        id: cachedProposal ? cachedProposal.id : 0,
        proposalId: proposal.id,
        chainId: config.CHAIN_ID,
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
        deposits,
        votes,
        ...(proposer && { proposer: proposer.proposer })
      }

      await mgr.save(ProposalEntity, proposalEntityObject)
      logger.info(`Saved proposal ${proposal.id}`)
    })
    .catch((err) => {
      logger.error(err)
      sentry.captureException(err)
    })
}
