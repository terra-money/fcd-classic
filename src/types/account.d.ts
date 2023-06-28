type AllAccount =
  | BaseAccount
  | ContinuousVestingAccount
  | DelayedVestingAccount
  | PeriodicVestingAccount
  | LazyGradedVestingAccount
  | ModuleAccount

interface BaseAccount {
  '@type': '/cosmos.auth.v1beta1.BaseAccount'
  address: string
  pub_key: { '@type': string; key: string } | null
  account_number: string
  sequence: string
}

interface BaseVestingAccount {
  base_account: BaseAccount
  original_vesting: Coins
  delegated_free: Coins
  delegated_vesting: Coins
  end_time: string
}

interface ContinuousVestingAccount {
  '@type': '/cosmos.vesting.v1beta1.ContinuousVestingAccount'
  base_vesting_account: BaseVestingAccount
  start_time: string
}

interface DelayedVestingAccount {
  '@type': '/cosmos.vesting.v1beta1.DelayedVestingAccount'
  base_vesting_account: BaseVestingAccount
}

interface VestingPeriod {
  length: string // unit: seconds
  amount: Coins
}

interface PeriodicVestingAccount {
  '@type': '/cosmos.vesting.v1beta1.PeriodicVestingAccount'
  base_vesting_account: BaseVestingAccount
  start_time: string
  // linear vesting from start_time to period.length (seconds)
  vesting_periods: VestingPeriod[]
}

interface LazyGradedVestingAccount {
  '@type': '/terra.vesting.v1beta1.LazyGradedVestingAccount'
  base_vesting_account: BaseVestingAccount
  vesting_schedules: VestingSchedules[]
}

interface VestingSchedules {
  denom: string
  schedules: Schedule[]
}

interface Schedule {
  start_time: string
  end_time: string
  ratio: string
}

interface ModuleAccount {
  '@type': '/cosmos.auth.v1beta1.ModuleAccount'
  base_account: BaseAccount
  name: string
  permissions: string[]
}

interface NormalizedAccount {
  address: string
  account_number: string
  sequence: string
  // For base accounts
  coins?: Coins
  // For vesting accounts
  original_vesting?: Coins
  delegated_free?: Coins
  delegated_vesting?: Coins
  vesting_schedules?: VestingSchedules[]
  // For module accounts
  name?: string
  permissions?: string[]
}
