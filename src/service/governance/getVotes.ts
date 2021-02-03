import { getRepository } from 'typeorm'
import { chain, get, reverse, uniqBy } from 'lodash'

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
  option?: voteOption
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

async function getVoteFromTx(tx): Promise<Vote[]> {
  const msgs = get(tx, 'tx.value.msg')
  const mapMsgToVote = async (msg): Promise<Vote | undefined> => {
    let answer: string | undefined
    let voter: string | undefined

    if (msg.type === 'gov/MsgVote') {
      answer = get(msg, 'value.option')
      voter = get(msg, 'value.voter')
    }

    if (!answer || !voter) {
      return
    }

    return {
      answer,
      voter: await getAccountInfo(voter)
    }
  }

  return Promise.all(msgs.map(mapMsgToVote))
}

function getUniqueVotes(votes: Vote[], option?: string): Vote[] {
  const uniqueVotes = uniqBy(reverse(votes), 'voter.accountAddress')

  if (option) {
    return uniqueVotes.filter((vote) => vote.answer === option)
  }

  return uniqueVotes
}

export default async function getVotes(input: GetProposalVotesInput): Promise<GetProposalVotesReturn | undefined> {
  const { proposalId, page, limit, option } = input

  const proposal = await getRepository(ProposalEntity).findOne({
    proposalId
    // chainId: config.CHAIN_ID
  })

  if (!proposal) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR, '', 'Proposal not found')
  }

  if (!proposal || (!proposal.voteTxs && !proposal.votes)) {
    return {
      totalCnt: 0,
      page,
      limit,
      votes: []
    }
  }

  let votes: Vote[] = []

  if (proposal.votes) {
    votes = await Promise.all(
      uniqBy(reverse(proposal.votes), 'voter').map((v) =>
        getAccountInfo(v.voter).then((accInfo) => ({
          answer: v.option,
          voter: accInfo
        }))
      )
    )
  }

  if (proposal.voteTxs) {
    const voteTxs = (await Promise.all(proposal.voteTxs.txs.map(getVoteFromTx))).flat().filter(Boolean)
    votes = getUniqueVotes(voteTxs, option)
  }

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
