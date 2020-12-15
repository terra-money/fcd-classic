import calculate from './calculate'
import getVesting from './getVesting'
import normalizeAccount from './normalizeAccount'

import { getAccount, getUnbondingDelegations, getLatestBlock } from 'lib/lcd'
import { sortDenoms } from 'lib/common'
import getDelegations from 'lib/getDelegations'

interface AccountDetails {
  balance: Balance[]
  vesting: Vesting[]
  delegations?: DelegationInfo[]
  unbondings?: LcdUnbonding[]
}

export default async (address: string): Promise<AccountDetails> => {
  const [rawAccount, unbondings, latestBlock, delegations] = await Promise.all([
    getAccount(address),
    getUnbondingDelegations(address),
    getLatestBlock(),
    getDelegations(address)
  ])

  const account = normalizeAccount(rawAccount)
  const latestBlockTimestamp = new Date(latestBlock.block.header.time).getTime()
  const balance = rawAccount && calculate(account, unbondings, latestBlockTimestamp)
  const vesting = rawAccount && getVesting(account, latestBlockTimestamp)

  return Object.assign(
    {},
    balance && { balance: sortDenoms(balance) },
    vesting && { vesting: sortDenoms(vesting) },
    { delegations },
    { unbondings }
  )
}
