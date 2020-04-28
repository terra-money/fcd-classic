interface DateRange {
  to: string // date format YYYY-MM-DD
  from: string // date format YYYY-MM-DD
}

interface BlockReward {
  reward_per_val: DenomMapByValidator
  commission_per_val: DenomMapByValidator
  height: number
  timestamp: Date
}
