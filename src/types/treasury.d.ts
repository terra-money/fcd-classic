interface LcdTaxRate {
  tax_rate: string
}

interface LcdStakingPool {
  not_bonded_tokens: string
  bonded_tokens: string
}

interface LcdTaxCap {
  denom: string
  tax_cap: string
}

interface LcdTreasuryParams {
  tax_policy: {
    rate_min: string
    rate_max: string
    cap: Coin
    change_rate_max: string
  }
  reward_policy: {
    rate_min: string
    rate_max: string
    cap: Coin
  }
  change_rate_max: string
  seigniorage_burden_target: string
  mining_increment: string
  window_short: string
  window_long: string
  window_probation: string
  burn_tax_split: string
  min_initial_deposit_ratio: string
}
