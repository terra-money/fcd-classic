import { getRepository } from 'typeorm'
import { filter, orderBy } from 'lodash'

import { ProposalEntity } from 'orm'
import config from 'config'

import * as lcd from 'lib/lcd'
import { getProposalBasic } from './helper'

interface ProposalsReturn {
  minDeposit: Coins // proposal min deposit
  maxDepositPeriod: string // deposit period
  votingPeriod: string // voting period
  proposals: ProposalBasic[]
}

export default async function getProposals(status?: string): Promise<ProposalsReturn> {
  const proposals = await getRepository(ProposalEntity).find({
    // chainId: config.CHAIN_ID
  })

  const depositParmas = await lcd.getProposalDepositParams()
  const { min_deposit: minDeposit, max_deposit_period: maxDepositPeriod } = depositParmas
  const { voting_period: votingPeriod } = await lcd.getProposalVotingParams()

  const orderedProposals = orderBy(
    await Promise.all(proposals.map((proposal) => getProposalBasic(proposal))),
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
