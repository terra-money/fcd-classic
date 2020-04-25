interface Wallet {
  [denom: string]: W
}

interface W {
  price: number
  total: number
  available: number
  delegatable: number
  [query: string]: number
}

interface DenomMap {
  [denom: string]: string
}

interface Balance {
  denom: string
  available: string
  delegatable: string
  delegatedVesting: string
  freedVesting: string
  remainingVesting: string
  unbonding: string
}
