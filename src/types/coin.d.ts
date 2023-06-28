type Coins = Coin[] | null

interface Coin {
  amount: string
  denom: string
}

interface DenomMap {
  [denom: string]: string
}

type DenomMapByValidator = { [validator: string]: DenomMap }
