enum AccountType {
  STANDARD = 'core/Account',
  VESTING = 'core/GradedVestingAccount', // Columbus-1
  LAZY_VESTING = 'core/LazyGradedVestingAccount', // Columbus-2 and 3
  MODULE = 'supply/ModuleAccount'
}

type Account = StandardAccount | VestingAccount | LazyVestingAccount | ModuleAccount

const getBaseAccount = (account: Account): AccountValue => {
  switch (account.type) {
    case AccountType.VESTING:
      return (account as VestingAccount).value.BaseVestingAccount.BaseAccount
    case AccountType.LAZY_VESTING:
      return (account as LazyVestingAccount).value.BaseVestingAccount.BaseAccount
    case AccountType.MODULE:
      return (account as ModuleAccount).value.BaseAccount
    default:
      return (account as StandardAccount).value
  }
}

const normalizeAccount = (account: Account): NormalizedAccount => {
  if (account.type === AccountType.VESTING) {
    // Columbus-1
    const vestingAccount = account as VestingAccount
    const vestingSchedules = vestingAccount.value.vesting_schedules.map(
      ({ denom, schedules: oldSchedules }): VestingSchedules => {
        let startTime = '1556085600000' // Columbus-1 genesis time

        const schedules = oldSchedules.map(({ cliff, ratio }) => {
          const schedule: Schedule = {
            start_time: startTime,
            end_time: (+cliff * 1000).toString(),
            ratio
          }

          startTime = schedule.end_time
          return schedule
        })

        return { denom, schedules }
      }
    )

    return {
      value: getBaseAccount(account),
      original_vesting: vestingAccount.value.BaseVestingAccount.original_vesting,
      delegated_free: vestingAccount.value.BaseVestingAccount.delegated_free,
      delegated_vesting: vestingAccount.value.BaseVestingAccount.delegated_vesting,
      vesting_schedules: vestingSchedules
    }
  }

  if (account.type === AccountType.LAZY_VESTING) {
    // Since Columbus-2
    return {
      value: getBaseAccount(account),
      original_vesting: (account as LazyVestingAccount).value.BaseVestingAccount.original_vesting,
      delegated_free: (account as LazyVestingAccount).value.BaseVestingAccount.delegated_free,
      delegated_vesting: (account as LazyVestingAccount).value.BaseVestingAccount.delegated_vesting,
      vesting_schedules: (account as LazyVestingAccount).value.vesting_schedules
    }
  }

  return {
    value: getBaseAccount(account)
  }
}

export default normalizeAccount
