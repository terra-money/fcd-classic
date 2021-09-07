import { getRepository } from 'typeorm'
import { ProposalEntity } from 'orm'
import * as lcd from 'lib/lcd'
import { getProposalBasic, ProposalStatus } from './helper'

interface ProposalsReturn {
  minDeposit: Coins // proposal min deposit
  maxDepositPeriod: string // deposit period
  votingPeriod: string // voting period
  proposals: ProposalBasic[]
}

function transformProposalStatusToNative(status: string): string {
  if (status === 'Voting') {
    return 'VotingPeriod'
  }
  if (status === 'Deposit') {
    return 'DepositPeriod'
  }

  return status
}

export default async function getProposals(status?: ProposalStatus): Promise<ProposalsReturn> {
  const qb = getRepository(ProposalEntity).createQueryBuilder().select().orderBy('submit_time', 'DESC')

  if (status) {
    qb.where({ status: transformProposalStatusToNative(status) })
  }

  const [
    proposals,
    { min_deposit: minDeposit, max_deposit_period: maxDepositPeriod },
    { voting_period: votingPeriod }
  ] = await Promise.all([qb.getMany(), lcd.getProposalDepositParams(), lcd.getProposalVotingParams()])

  const transformedProposals = await Promise.all(proposals.map(getProposalBasic))

  return {
    minDeposit,
    maxDepositPeriod,
    votingPeriod,
    proposals: transformedProposals
  }
}
