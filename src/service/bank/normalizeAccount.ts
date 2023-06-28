const normalizeAccount = (candidate: AllAccount, coins: Coin[]): NormalizedAccount => {
  switch (candidate['@type']) {
    case '/cosmos.auth.v1beta1.BaseAccount': {
      const account = candidate as BaseAccount

      return {
        ...account,
        coins
      }
    }
    case '/cosmos.vesting.v1beta1.ContinuousVestingAccount':
    case '/cosmos.vesting.v1beta1.DelayedVestingAccount':
    case '/cosmos.vesting.v1beta1.PeriodicVestingAccount': {
      return {
        ...candidate.base_vesting_account.base_account,
        coins,
        original_vesting: candidate.base_vesting_account.original_vesting,
        delegated_free: candidate.base_vesting_account.delegated_free,
        delegated_vesting: candidate.base_vesting_account.delegated_vesting
      }
    }
    case '/terra.vesting.v1beta1.LazyGradedVestingAccount': {
      const account = candidate as LazyGradedVestingAccount

      return {
        ...account.base_vesting_account.base_account,
        coins,
        original_vesting: account.base_vesting_account.original_vesting,
        delegated_free: account.base_vesting_account.delegated_free,
        delegated_vesting: account.base_vesting_account.delegated_vesting,
        vesting_schedules: account.vesting_schedules
      }
    }
    case '/cosmos.auth.v1beta1.ModuleAccount': {
      const account = candidate as ModuleAccount

      return {
        ...account.base_account
      }
    }
  }

  throw new Error(`unknown account type ${candidate['@type']}, value: ${JSON.stringify(candidate)}`)
}

export default normalizeAccount
