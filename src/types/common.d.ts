interface DateRange {
  to: string // date format yyyy-MM-dd
  from: string // date format yyyy-MM-dd
}

interface BlockReward {
  reward_per_val: DenomMapByValidator
  commission_per_val: DenomMapByValidator
  height: number
  timestamp: Date
}
