enum AccountType {
  BASE_COL1 = 'auth/Account', // columbus-1
  BASE_COL3 = 'core/Account', // columbus-3
  VESTING = 'core/GradedVestingAccount', // columbus-1
  LAZY_VESTING = 'core/LazyGradedVestingAccount', // columbus-2
  MODULE_COL4 = 'supply/ModuleAccount', // columbus-4
  MODULE = 'core/ModuleAccount' // columbus-5
}

type Account =
  | StandardAccount
  | VestingAccount
  | LazyVestingAccount
  | Columbus3LazyVestingAccount
  | Columbus4LazyVestingAccount
  | Columbus3ModuleAccount
  | ModuleAccount

const normalizeAccount = (account: Account): NormalizedAccount => {
  if (account.type === AccountType.VESTING) {
    const value = (account as VestingAccount).value.BaseVestingAccount.BaseAccount

    // columbus-1
    const vestingAccount = account as VestingAccount
    const vestingSchedules = vestingAccount.value.vesting_schedules.map(
      ({ denom, schedules: oldSchedules }): VestingSchedules => {
        let startTime = '1556085600000' // columbus-1 genesis time

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
      value,
      original_vesting: vestingAccount.value.BaseVestingAccount.original_vesting,
      delegated_free: vestingAccount.value.BaseVestingAccount.delegated_free,
      delegated_vesting: vestingAccount.value.BaseVestingAccount.delegated_vesting,
      vesting_schedules: vestingSchedules
    }
  }

  if (account.type === AccountType.LAZY_VESTING) {
    // Columbus-5
    if ('base_vesting_account' in account.value) {
      const value = (account as LazyVestingAccount).value

      return {
        value: {
          ...value.base_vesting_account.base_account,
          coins: value.coins
        },
        original_vesting: value.base_vesting_account.original_vesting,
        delegated_free: value.base_vesting_account.delegated_free,
        delegated_vesting: value.base_vesting_account.delegated_vesting,
        vesting_schedules: value.vesting_schedules
      }
    }

    // Columbus-4
    if ('address' in account.value) {
      const value = (account as Columbus4LazyVestingAccount).value

      return {
        value,
        original_vesting: value.original_vesting,
        delegated_free: value.delegated_free,
        delegated_vesting: value.delegated_vesting,
        vesting_schedules: value.vesting_schedules
      }
    }

    // Columbus-3 and past
    if ('BaseVestingAccount' in account.value) {
      // Before columbus-4
      const value = (account as Columbus3LazyVestingAccount).value

      return {
        value: value.BaseVestingAccount.BaseAccount,
        original_vesting: value.BaseVestingAccount.original_vesting,
        delegated_free: value.BaseVestingAccount.delegated_free,
        delegated_vesting: value.BaseVestingAccount.delegated_vesting,
        vesting_schedules: value.vesting_schedules
      }
    }

    throw new Error(`unknown LazyGradedVestingAccount, value: ${JSON.stringify(account.value)}`)
  }

  if (account.type === AccountType.MODULE || account.type === AccountType.MODULE_COL4) {
    // LCD response in columbus-2 and 3 and columbus-4 are different.
    if ('BaseAccount' in account.value) {
      const value = (account as Columbus3ModuleAccount).value

      return {
        value: value.BaseAccount,
        name: value.name,
        permissions: value.permissions
      }
    }

    // From columbus-4
    const value = (account as ModuleAccount).value

    return {
      value,
      name: value.name,
      permissions: value.permissions
    }
  }

  if (account.type === AccountType.BASE_COL1 || account.type === AccountType.BASE_COL3) {
    return {
      value: (account as StandardAccount).value
    }
  }

  throw new Error(`unknown account type ${account.type}, value: ${JSON.stringify(account.value)}`)
}

export default normalizeAccount
