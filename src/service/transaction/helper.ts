import { get, filter } from 'lodash'

export const getSwapCoinAndFee = (log): { swapCoin: string; swapFee: string } => {
  let swapCoin = ''
  let swapFee = ''

  if (!log) {
    return { swapCoin, swapFee }
  }

  const { events } = log

  if (!events || get(log, 'log.swap_coin')) {
    swapCoin = get(log, 'log.swap_coin', '')
    swapFee = get(log, 'log.swap_fee', '')
    return { swapCoin, swapFee }
  }

  const swapEvent = filter(events, { type: 'swap' })[0]

  if (!swapEvent || !Array.isArray(swapEvent.attributes)) {
    return { swapCoin, swapFee }
  }

  swapCoin = filter(swapEvent.attributes, { key: 'swap_coin' })[0].value
  swapFee = filter(swapEvent.attributes, { key: 'swap_fee' })[0].value

  return { swapCoin, swapFee }
}
