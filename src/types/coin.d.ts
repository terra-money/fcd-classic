type Coins = Coin[] | null

type Coin = {
  amount: string
  denom: string
}

type DenomMap = {
  [denom: string]: string
}

type DenomMapByValidator = {
  [validator: string]: DenomMap
}
