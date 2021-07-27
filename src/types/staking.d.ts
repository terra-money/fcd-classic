interface LcdStakingDelegation {
  delegation: {
    delegator_address: string
    validator_address: string
    shares: string
  }
  balance: Coin
}

interface LcdStakingEntry {
  creation_height: string
  completion_time: string
  initial_balance: string
  balance: string
  shares_dst?: string // Only for redelegations
}

interface LcdStakingUnbonding {
  delegator_address: string
  validator_address: string
  entries: LcdStakingEntry[]
}

interface LCDStakingRelegation {
  delegator_address: string
  validator_src_address: string
  validator_dst_address: string
  entries: LcdStakingEntry[]
}
