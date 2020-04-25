import * as moment from 'moment'
import { get } from 'lodash'

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

function getTimestampFromBlock(block): number {
  const blockTimestampStr = get(block, 'block_meta.header.time', NaN)
  return blockTimestampStr && moment(blockTimestampStr).valueOf()
}

export default async (address: string): Promise<AccountDetails> => {
  const [accounts, unbondings, latestBlock, delegations] = await Promise.all([
    getAccount(address),
    getUnbondingDelegations(address),
    getLatestBlock(),
    getDelegations(address)
  ])

  const account = normalizeAccount(accounts)
  const latestBlockTimestamp = getTimestampFromBlock(latestBlock)
  const balance = accounts && calculate({ account, delegations, unbondings, latestBlockTimestamp })
  const vesting = accounts && getVesting({ account, latestBlockTimestamp })

  return Object.assign(
    {},
    balance && { balance: sortDenoms(balance) },
    vesting && { vesting: sortDenoms(vesting) },
    { delegations: delegations ? delegations : [] },
    { unbondings }
  )
}
