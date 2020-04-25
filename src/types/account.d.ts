interface NormalizedAccount {
  value: AccountValue
  original_vesting?: Coins
  delegated_free?: Coins
  delegated_vesting?: Coins
  vesting_schedules?: VestingLazySchedule[]
}

interface StandardAccount {
  type: string
  value: AccountValue
}

interface VestingAccount {
  type: string
  value: {
    BaseVestingAccount: {
      BaseAccount: AccountValue
      original_vesting: Coins
      delegated_free: Coins
      delegated_vesting: Coins
      end_time: string
    }
    vesting_schedules: VestingLazySchedule[]
  }
}

interface ModuleAccount {
  type: string
  value: {
    BaseAccount: AccountValue
    name: string
    permissions: string[]
  }
}

interface AccountValue {
  address: string
  coins: Coins
  public_key: { type: string; value: string }
  account_number: string
  sequence: string
}

interface VestingLazySchedule {
  denom: string
  schedules: Schedule[]
}

interface Schedule {
  start_time: string
  end_time: string
  ratio: string
}

interface AccountCountInfo {
  datetime: number // datetime in unix
  totalAccountCount: number
  activeAccountCount: number
}

interface AccountGrowthReturn {
  periodic: AccountCountInfo[]
  cumulative: AccountCountInfo[]
}

interface BlockRewardSumInfo {
  datetime: number // datetiem in unix
  blockReward: string // big interger
}

interface BlockRewardsReturn {
  periodic: BlockRewardSumInfo[]
  cumulative: BlockRewardSumInfo[]
}
