import { AccAddress, ValAddress } from '@terra-money/terra.js'
import format from 'lib/format'
import { decode, isValid } from 'js-base64'

const prettifyWasmMsg = (str: string | object) => {
  if (typeof str === 'string' && isValid(str)) {
    return JSON.parse(decode(str))
  }

  return str
}

export function sliceMsgType(msg: string) {
  if (!msg || typeof msg === 'object') return 'unknown msg'
  const msgResult = String(msg)
  const slashIndex = msgResult.indexOf('/')
  return slashIndex > -1 ? msgResult.slice(slashIndex + 1) : msgResult
}

export function getAmountAndDenom(tax: string): Coin {
  const result = /-?\d*\.?\d+/g.exec(tax)

  if (!result) {
    return {
      amount: '0',
      denom: ''
    }
  }

  return {
    amount: result[0],
    denom: tax.slice(result[0].length)
  }
}

export const getMsgValue = (msg: Transaction.Message, key: string) => {
  const value = {}

  if (AccAddress.validate(msg.value[key]) || ValAddress.validate(msg.value[key])) {
    value[key] = msg.value[key]
  } else if (key === 'amount' || key === 'offer_coin') {
    value[key] = Array.isArray(msg.value[key])
      ? msg.value[key].map((item: Coin) => `${format.coin(item)}`)
      : `${format.coin(msg.value[key] as Coin)}`
  } else if (key === 'ask_denom' || key === 'denom') {
    value[key] = format.denom(msg.value[key])
  } else if (key === 'execute_msg') {
    value[key] = prettifyWasmMsg(msg.value[key])
  } else {
    value[key] = Array.isArray(msg.value[key])
      ? msg.value[key].map((j: any) => `${JSON.stringify(j, undefined, 2)}`)
      : JSON.stringify(msg.value[key])
  }

  return value
}
