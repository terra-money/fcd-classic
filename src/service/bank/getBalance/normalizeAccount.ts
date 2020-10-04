import { APIError } from 'lib/error'

enum AccountType {
  STANDARD = 'core/Account',
  VESTING = 'core/GradedVestingAccount', // Columbus-1
  LAZY_VESTING = 'core/LazyGradedVestingAccount', // Columbus-2 and 3
  MODULE = 'supply/ModuleAccount'
}

type Account =
  | StandardAccount
  | VestingAccount
  | Columbus3LazyVestingAccount
  | LazyVestingAccount
  | Columbus3ModuleAccount
  | ModuleAccount

const normalizeAccount = (account: Account): NormalizedAccount => {
  if (account.type === AccountType.VESTING) {
    const value = (account as VestingAccount).value.BaseVestingAccount.BaseAccount

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
      value,
      original_vesting: vestingAccount.value.BaseVestingAccount.original_vesting,
      delegated_free: vestingAccount.value.BaseVestingAccount.delegated_free,
      delegated_vesting: vestingAccount.value.BaseVestingAccount.delegated_vesting,
      vesting_schedules: vestingSchedules
    }
  }

  if (account.type === AccountType.LAZY_VESTING) {
    // columbus-2 and columbus-3 shapes are different in columbus-4
    if ('BaseVestingAccount' in account.value) {
      const value = (account as Columbus3LazyVestingAccount).value

      return {
        value: value.BaseVestingAccount.BaseAccount,
        original_vesting: value.BaseVestingAccount.original_vesting,
        delegated_free: value.BaseVestingAccount.delegated_free,
        delegated_vesting: value.BaseVestingAccount.delegated_vesting,
        vesting_schedules: value.vesting_schedules
      }
    }

    const value = (account as LazyVestingAccount).value

    return {
      value,
      original_vesting: value.original_vesting,
      delegated_free: value.delegated_free,
      delegated_vesting: value.delegated_vesting,
      vesting_schedules: value.vesting_schedules
    }
  }

  if (account.type === AccountType.MODULE) {
    if ('BaseAccount' in account.value) {
      const value = (account as Columbus3ModuleAccount).value

      return {
        value: value.BaseAccount,
        name: value.name,
        permissions: value.permissions
      }
    }

    const value = (account as ModuleAccount).value

    return {
      value,
      name: value.name,
      permissions: value.permissions
    }
  }

  if (account.type === AccountType.STANDARD) {
    return {
      value: (account as StandardAccount).value
    }
  }

  throw new Error(`unknown account type ${account.type}, address: ${account.value}`)
}

export default normalizeAccount
