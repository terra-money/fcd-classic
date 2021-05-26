interface LcdDelegation {
  delegation: {
    delegator_address: string
    validator_address: string
    shares: string
  }
  balance: Coin
}

interface LcdUnbonding {
  delegator_address: string
  validator_address: string
  entries: LcdUnbondingEntry[]
}

interface LcdUnbondingEntry {
  creation_height: string
  completion_time: string
  initial_balance: string
  balance: string
}

interface DelegationInfo {
  delegator_address: string
  validator_address: string
  shares: string
  amount: string
}
