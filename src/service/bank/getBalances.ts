import calculate from './calculate'
import getVesting from './getVesting'
import * as lcd from 'lib/lcd'
import { sortDenoms } from 'lib/common'
import { ErrorTypes, APIError } from 'lib/error'
import { getDelegations, DelegationInfo } from 'service/staking/getDelegations'
import normalizeAccount from './normalizeAccount'

interface AccountDetails {
  balance: Balance[]
  vesting: Vesting[]
  delegations?: DelegationInfo[]
  unbondings?: LcdStakingUnbonding[]
}

export async function getBalances(address: string): Promise<AccountDetails> {
  const lcdAccount = await lcd.getAccount(address)

  if (!lcdAccount) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR)
  }

  const [lcdBalance, unbondings, latestBlock, delegations] = await Promise.all([
    lcd.getBalance(address),
    lcd.getUnbondingDelegations(address),
    lcd.getLatestBlock(),
    getDelegations(address)
  ])

  const normalizedAccount = normalizeAccount(lcdAccount, lcdBalance)
  const latestBlockTimestamp = new Date(latestBlock.block.header.time).getTime()
  const balance = sortDenoms(calculate(normalizedAccount, unbondings, latestBlockTimestamp))
  const vesting = sortDenoms(getVesting(normalizedAccount, latestBlockTimestamp))

  return {
    balance,
    vesting,
    delegations,
    unbondings
  }
}
