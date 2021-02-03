import { getRepository } from 'typeorm'
import { get, chain, compact } from 'lodash'

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

async function getDepositFromTx(tx): Promise<Deposit[]> {
  const msgs = get(tx, 'tx.value.msg')
  const mapMsgToDeposit = async (msg) => {
    let deposit: Coin | undefined
    let depositor: string | undefined

    if (msg.type === 'gov/MsgSubmitProposal') {
      deposit = get(msg, 'value.initial_deposit')
      depositor = get(msg, 'value.proposer')
    } else if (msg.type === 'gov/MsgDeposit') {
      deposit = get(msg, 'value.amount')
      depositor = get(msg, 'value.depositor')
    }

    if (!deposit || !depositor) {
      return
    }

    const accountInfo = await getAccountInfo(depositor)

    return {
      deposit,
      depositor: accountInfo
    }
  }

  return compact(await Promise.all(msgs.map(mapMsgToDeposit)))
}

export default async function getProposalDeposits(input: GetProposalDepositsInput): Promise<GetProposalDepositsReturn> {
  const { proposalId, page, limit } = input
  const proposal = await getRepository(ProposalEntity).findOne({
    proposalId
    // chainId: config.CHAIN_ID
  })

  if (!proposal) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR, '', 'Proposal not found')
  }

  if ((!proposal.depositTxs || !proposal.depositTxs.txs) && (!proposal.deposits || !proposal.deposits.length)) {
    return {
      totalCnt: 0,
      page,
      limit,
      deposits: []
    }
  }

  let deposits: Deposit[] = []

  if (proposal.deposits) {
    deposits = await Promise.all(
      proposal.deposits.map((v) =>
        getAccountInfo(v.depositor).then((accInfo) => ({
          deposit: v.amount,
          depositor: accInfo
        }))
      )
    )
  }

  if (proposal.depositTxs) {
    deposits = await Promise.all(proposal.depositTxs.txs.map((tx) => getDepositFromTx(tx))).then((result) =>
      result.flat().filter((tx) => tx.deposit.length > 0)
    )
  }

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
