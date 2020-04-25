type Coins = Coin[] | null

interface Coin {
  amount: string
  denom: string
}

interface CoinByDenoms {
  // common coin interface for issuance, price, communitypool for denoms set
  ukrw?: string // bigint value
  uluna?: string // bigint value
  umnt?: string // bigint value
  usdr?: string // bigint value
  uusd?: string // bigint value
}
