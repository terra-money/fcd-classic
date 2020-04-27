import BigNumber from 'bignumber.js'

export const plus = (a: BigNumber.Value, b: BigNumber.Value): string => new BigNumber(a || 0).plus(b || 0).toString()

export const minus = (a: BigNumber.Value, b: BigNumber.Value): string => new BigNumber(a || 0).minus(b || 0).toString()

export const times = (a: BigNumber.Value, b: BigNumber.Value): string => new BigNumber(a || 0).times(b || 0).toString()

export const div = (a: BigNumber.Value, b: BigNumber.Value): string => new BigNumber(a || 0).div(b || 1).toString()

export const isFinite = (n: BigNumber.Value): boolean => new BigNumber(n).isFinite()

export const isInteger = (n: BigNumber.Value): boolean => new BigNumber(n).isInteger()

export const sum = (array?: BigNumber.Value[]): string => {
  if (array !== undefined && !Array.isArray(array)) {
    throw new TypeError('not an array')
  }

  const normalized = (array || []).filter(isFinite)

  if (!normalized.length) {
    normalized[0] = 0
  }

  return BigNumber.sum(...normalized).toString()
}

export const min = (array?: BigNumber.Value[]): string => {
  if (array !== undefined && !Array.isArray(array)) {
    throw new TypeError('not an array')
  }

  const normalized = (array || []).filter(isFinite)

  if (!normalized.length) {
    normalized[0] = 0
  }

  return BigNumber.min.apply(null, normalized).toString()
}

export const getIntegerPortion = (input: string): string => new BigNumber(input).toFixed(0)
