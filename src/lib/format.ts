import BigNumber from 'bignumber.js'

const formatDecimal = (number: BigNumber.Value): string =>
  new BigNumber(number).decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(6)

const formatAmount = (amount: BigNumber.Value): string =>
  new BigNumber(amount).div(1e6).decimalPlaces(6, BigNumber.ROUND_DOWN).toFormat(6)

const formatDenom = (denom: string): string => {
  const f = denom.slice(1)
  return f && (f === 'luna' ? 'Luna' : `${f.slice(0, 2).toUpperCase()}T`)
}

const formatCoin = ({ amount, denom }: Coin): string => [formatAmount(amount), formatDenom(denom)].join(' ')

export default {
  decimal: formatDecimal,
  amount: formatAmount,
  denom: formatDenom,
  coin: formatCoin,
  coins: (coins: Coin[]): string[] => coins.map(formatCoin)
}
