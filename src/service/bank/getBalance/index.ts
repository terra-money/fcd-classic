import calculate from './calculate'
import getVesting from './getVesting'
import normalizeAccount from './normalizeAccount'

import { getAccount, getUnbondingDelegations, getLatestBlock } from 'lib/lcd'
import { sortDenoms } from 'lib/common'
import { getDelegations, DelegationInfo } from 'lib/getDelegations'

interface AccountDetails {
  balance: Balance[]
  vesting: Vesting[]
  delegations?: DelegationInfo[]
  unbondings?: LcdStakingUnbonding[]
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
  const balance = sortDenoms(calculate(account, unbondings, latestBlockTimestamp))
  const vesting = sortDenoms(getVesting(account, latestBlockTimestamp))

  return {
    balance,
    vesting,
    delegations,
    unbondings
  }
}
