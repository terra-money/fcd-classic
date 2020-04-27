import * as lcd from 'lib/lcd'
import { getProposalBasic } from './helper'
import { filter, orderBy } from 'lodash'

interface ProposalsReturn {
  minDeposit: Coins // proposal min deposit
  maxDepositPeriod: string // deposit period
  votingPeriod: string // voting period
  proposals: ProposalBasic[]
}

export default async function getProposals(status?: string): Promise<ProposalsReturn> {
  const lcdProposals = await lcd.getProposals()
  const depositParmas = await lcd.getProposalDepositParams()
  const { min_deposit: minDeposit, max_deposit_period: maxDepositPeriod } = depositParmas
  const { voting_period: votingPeriod } = await lcd.getProposalVotingParams()

  const orderedProposals = orderBy(
    await Promise.all(lcdProposals.map((proposal) => getProposalBasic(proposal, depositParmas, true))),
    ['submitTime'],
    ['desc']
  )

  return {
    minDeposit,
    maxDepositPeriod,
    votingPeriod,
    proposals: status ? filter(orderedProposals, { status }) : orderedProposals
  }
}
