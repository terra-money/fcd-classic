import { default as parseDuration } from 'parse-duration'
import * as bech32 from 'bech32'
import * as bech32buffer from 'bech32-buffer'
import { orderBy } from 'lodash'
import config from 'config'

export enum TimeIntervals {
  ONE_MIN = '1m',
  FIVE_MIN = '5m',
  FIFTEEN_MIN = '15m',
  THIRTY_MIN = '30m',
  ONE_HOUR = '1h',
  ONE_DAY = '1d'
}

export enum ActiveDenomsEnum {
  UKRW = 'ukrw',
  UMNT = 'umnt',
  USDR = 'usdr',
  UUSD = 'uusd',
  ULUNA = 'uluna'
}

const CURRENCY_BY_DENOMS = new Map([
  ['uluna', 'Luna'],
  ['ukrw', 'KRT'],
  ['uusd', 'UST'],
  ['usdr', 'SDT'],
  ['ugbp', 'GBT'],
  ['ueur', 'EUT'],
  ['ujpy', 'JPT'],
  ['ucny', 'CNT']
])

export function denomToCurrency(denom: string): string {
  return CURRENCY_BY_DENOMS.get(denom.toLowerCase()) || denom.toUpperCase()
}

const DENOM_BY_CURRENCIES = new Map([
  ['luna', 'uluna'],
  ['krw', 'ukrw'],
  ['krt', 'ukrw'],
  ['ust', 'uusd'],
  ['sdt', 'usdr'],
  ['gbt', 'ugbp'],
  ['eut', 'ueur'],
  ['jpt', 'ujpy'],
  ['cnt', 'ucny'],
  ['mnt', 'umnt']
])

export function currencyToDenom(currency): string {
  const lowerCaseCurrency = currency.toLowerCase()
  return DENOM_BY_CURRENCIES.get(lowerCaseCurrency) || lowerCaseCurrency
}

// TODO: figure out the use of this function
export function candleInitialTs(timestamp: number, timeframe: string): number {
  const msc = parseDuration(timeframe) || 1
  return timestamp - (timestamp % msc) - msc
}

export function convertValAddressToAccAddress(address: string): string {
  const { words } = bech32.decode(address)
  return bech32.encode('terra', words)
}

export function convertValConAddressToDecodedHex(address: string): string {
  const { data } = bech32buffer.decode(address)
  return Buffer.from(data).toString('hex')
}

export function convertAccAddressToValAddress(address: string): string {
  const { words } = bech32.decode(address)
  return bech32.encode('terravaloper', words)
}

export function convertHexToValConAddress(hexstring: string): string {
  return bech32buffer.encode('terravalcons', Buffer.from(hexstring, 'hex'))
}

export function isNumeric(data: string): boolean {
  return !isNaN(Number(data))
}

const DENOM_ORDER = ['uluna', 'ukrw', 'usdr', 'uusd']

export function sortDenoms<T>(coins: (T & { denom: string })[]): T[] {
  return orderBy<T & { denom: string }>(
    coins,
    [(coin): number => (DENOM_ORDER.includes(coin.denom) ? DENOM_ORDER.indexOf(coin.denom) : 999)],
    ['asc']
  )
}

const AMOUNT_DENOM_REGEXP = /[A-Z]{1,16}|[^A-Z]{1,64}/gi

export function splitDenomAndAmount(denomAndAmount: string): Coin {
  const [amount, denom] = denomAndAmount.match(AMOUNT_DENOM_REGEXP) || ['', '']
  return { amount, denom }
}

export function denomObjectToArray(denomObject: DenomTxVolumeObject, sliceCnt: number): DenomTxVolume[] {
  return sortDenoms(Object.keys(denomObject).map((denom) => ({ denom, data: denomObject[denom].slice(sliceCnt) })))
}

export function isActiveDenom(input: string) {
  return config.ACTIVE_DENOMS.includes(input)
}

export function isActiveCurrency(input: string) {
  return config.ACTIVE_CURRENCY.includes(input)
}
