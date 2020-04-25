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
  const proposals = await lcd.getProposals()
  const depositParmas = await lcd.getProposalDepositParams()
  const { min_deposit: minDeposit, max_deposit_period: maxDepositPeriod } = depositParmas
  const { voting_period: votingPeriod } = await lcd.getProposalVotingParams()
  const getProposalReq = proposals.map((proposal) => {
    return getProposalBasic(proposal, depositParmas, true)
  })

  const proposalInfo = orderBy(await Promise.all(getProposalReq), ['submitTime'], ['desc'])

  return {
    minDeposit,
    maxDepositPeriod,
    votingPeriod,
    proposals: status ? filter(proposalInfo, { status }) : proposalInfo
  }
}
