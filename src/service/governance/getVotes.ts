import { getRepository } from 'typeorm'
import { chain, reverse, uniqBy } from 'lodash'

import { ProposalEntity } from 'orm'

import { APIError, ErrorTypes } from 'lib/error'
import getAccountInfo from './helper/getAccountInfo'

export enum VoteTypes {
  YES = 'Yes',
  NO = 'No',
  NO_WITH_VETO = 'NoWithVeto',
  ABSTAIN = 'Abstain'
}

interface GetProposalVotesInput {
  proposalId: string
  page: number
  limit: number
  option?: VoteOption
}

interface Vote {
  answer: string
  voter: {
    accountAddress: string
    operatorAddress?: string
    moniker?: string
  }
}

interface GetProposalVotesReturn {
  totalCnt: number
  page: number
  limit: number
  votes: Vote[]
}

export default async function getVotes(input: GetProposalVotesInput): Promise<GetProposalVotesReturn | undefined> {
  const { proposalId, page, limit } = input

  const proposal = await getRepository(ProposalEntity).findOne({
    proposalId
    // chainId: config.CHAIN_ID
  })

  if (!proposal) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR, '', 'Proposal not found')
  }

  if (!proposal || !proposal.votes.length) {
    return {
      totalCnt: 0,
      page,
      limit,
      votes: []
    }
  }

  const uniqueVotes: Vote[] = await Promise.all(
    uniqBy(reverse(proposal.votes), 'voter')
      .map((v) =>
        getAccountInfo(v.voter).then((accInfo) => ({
          answer: v.option,
          voter: accInfo
        }))
      )
  )

  const votes = !input.option ? uniqueVotes : uniqueVotes.filter(v => v.answer === input.option)

  return {
    totalCnt: votes.length,
    page,
    limit,
    votes: chain(votes)
      .drop((page - 1) * limit)
      .take(limit)
      .value()
  }
}
