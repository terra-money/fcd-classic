interface CountInfoByDate {
  datetime: number // datetime in unix
  value: number
}

interface AccountCountInfo {
  datetime: number
  activeAccountCount: number
  totalAccountCount: number
}

interface AccountGrowthReturn {
  periodic: AccountCountInfo[]
  cumulative: AccountCountInfo[]
}

interface AccountStatReturn {
  total: number
  periodic: CountInfoByDate[]
  cumulative?: CountInfoByDate[]
}

interface BlockRewardSumInfo {
  datetime: number // datetiem in unix
  blockReward: string // big interger
}

interface BlockRewardsReturn {
  periodic: BlockRewardSumInfo[]
  cumulative: BlockRewardSumInfo[]
}
