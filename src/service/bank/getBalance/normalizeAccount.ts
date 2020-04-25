export enum AccountType {
  STANDARD = 'core/Account',
  VESTING = 'core/LazyGradedVestingAccount',
  MODULE = 'supply/ModuleAccount'
}
type Account = StandardAccount | VestingAccount | ModuleAccount

const getAccountValue = (account: Account): AccountValue => {
  switch (account.type) {
    case AccountType.VESTING:
      return (account as VestingAccount).value.BaseVestingAccount.BaseAccount
    case AccountType.MODULE:
      return (account as ModuleAccount).value.BaseAccount
    default:
      return (account as StandardAccount).value
  }
}

export default (account: Account): NormalizedAccount =>
  Object.assign(
    {
      value: getAccountValue(account)
    },
    account.type === AccountType.VESTING && {
      original_vesting: (account as VestingAccount).value.BaseVestingAccount.original_vesting,
      delegated_free: (account as VestingAccount).value.BaseVestingAccount.delegated_free,
      delegated_vesting: (account as VestingAccount).value.BaseVestingAccount.delegated_vesting,
      vesting_schedules: (account as VestingAccount).value.vesting_schedules
    }
  )
