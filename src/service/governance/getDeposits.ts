import { getRepository } from 'typeorm'
import { chain } from 'lodash'

import { ProposalEntity } from 'orm'

import { APIError, ErrorTypes } from 'lib/error'
import getAccountInfo from './helper/getAccountInfo'

interface GetProposalDepositsInput {
  proposalId: string
  page: number
  limit: number
}

interface Deposit {
  deposit: Coin[]
  depositor: {
    accountAddress: string
    operatorAddress?: string
    moniker?: string
  }
}

interface GetProposalDepositsReturn {
  totalCnt: number
  page: number
  limit: number
  deposits: Deposit[]
}

export default async function getProposalDeposits(input: GetProposalDepositsInput): Promise<GetProposalDepositsReturn> {
  const { proposalId, page, limit } = input
  const proposal = await getRepository(ProposalEntity).findOne({
    proposalId
    // chainId: config.CHAIN_ID
  })

  if (!proposal || !proposal.deposits.length) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR, '', 'Proposal not found')
  }

  const deposits: Deposit[] = await Promise.all(
    proposal.deposits.map((v) =>
      getAccountInfo(v.depositor).then((accInfo) => ({
        deposit: v.amount,
        depositor: accInfo
      }))
    )
  )

  return {
    totalCnt: deposits.length,
    page,
    limit,
    deposits: chain(deposits)
      .reverse()
      .drop((page - 1) * limit)
      .take(limit)
      .value()
  }
}
