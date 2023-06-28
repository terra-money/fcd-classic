interface LcdStakingPool {
  not_bonded_tokens: string
  bonded_tokens: string
}

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
}

interface LcdStakingUnbonding {
  delegator_address: string
  validator_address: string
  entries: LcdStakingEntry[]
}

interface LcdRedelegationEntry {
  redelegation_entry: {
    creation_height: string
    completion_time: string
    initial_balance: string
    shares_dst: string
  }
  balance: string
}

interface LCDStakingRelegation {
  redelegation: {
    delegator_address: string
    validator_src_address: string
    validator_dst_address: string
  }
  entries: LcdRedelegationEntry[]
}
