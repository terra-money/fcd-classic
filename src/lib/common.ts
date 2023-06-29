import { bech32 } from 'bech32'
import { orderBy } from 'lodash'
import config from 'config'
import { BOND_DENOM } from './constant'

export enum TimeIntervals {
  ONE_MIN = '1m',
  FIVE_MIN = '5m',
  FIFTEEN_MIN = '15m',
  THIRTY_MIN = '30m',
  ONE_HOUR = '1h',
  ONE_DAY = '1d'
}

const CURRENCY_BY_DENOMS = new Map([
  ['uluna', 'Luna'],
  ['ukrw', 'KRT'],
  ['uusd', 'UST'],
  ['usdr', 'SDT'],
  ['ugbp', 'GBT'],
  ['ueur', 'EUT'],
  ['ujpy', 'JPT'],
  ['ucny', 'CNT'],
  ['uinr', 'INT'],
  ['ucad', 'CAT'],
  ['uchf', 'CHT'],
  ['uhkd', 'HKT'],
  ['uaud', 'AUT']
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
  ['mnt', 'umnt'],
  ['int', 'uinr'],
  ['cat', 'ucad'],
  ['cht', 'uchf'],
  ['hkt', 'uhkd'],
  ['aut', 'uaud']
])

export function currencyToDenom(currency): string {
  const lowerCaseCurrency = currency.toLowerCase()
  return DENOM_BY_CURRENCIES.get(lowerCaseCurrency) || lowerCaseCurrency
}

type Prefix = 'terra' | 'terrapub' | 'terravaloper' | 'terravaloperpub' | 'terravalcons' | 'terravalconspub'

export function convertAddress(prefix: Prefix, address: string): string {
  const { words } = bech32.decode(address)
  return bech32.encode(prefix, words)
}

export function convertAddressToHex(address: string): string {
  return Buffer.from(bech32.fromWords(bech32.decode(address).words)).toString('hex')
}

export function convertHexToAddress(prefix: Prefix, hexstring: string): string {
  return bech32.encode(prefix, bech32.toWords(Buffer.from(hexstring, 'hex')))
}

export function isNumeric(data: string): boolean {
  return !isNaN(Number(data))
}

const DENOM_ORDER = [BOND_DENOM, 'ukrw', 'usdr', 'uusd']

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

export function isActiveCurrency(input: string) {
  return config.ACTIVE_CURRENCY.includes(input)
}
