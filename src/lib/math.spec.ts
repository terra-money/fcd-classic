import { plus, minus, times, div, isFinite, isInteger, sum, min, getIntegerPortion } from './math'

describe('math', () => {
  test('plus(undefined, undefined)', () => {
    expect(plus(undefined as any, undefined as any)).toBe('0')
  })

  test('plus(10, undefined)', () => {
    expect(plus(10, undefined as any)).toBe('10')
  })

  test(`plus(undefined, '10')`, () => {
    expect(plus(undefined as any, '10')).toBe('10')
  })

  test('plus(50, 50)', () => {
    expect(plus(50, 50)).toBe('100')
  })

  test('minus(undefined, undefined)', () => {
    expect(minus(undefined as any, undefined as any)).toBe('0')
  })

  test('minus(10, undefined)', () => {
    expect(minus(10, undefined as any)).toBe('10')
  })

  test(`minus(undefined, '10')`, () => {
    expect(minus(undefined as any, '10')).toBe('-10')
  })

  test('minus(100, 50)', () => {
    expect(minus(100, 50)).toBe('50')
  })

  test('times(undefined, undefined)', () => {
    expect(times(undefined as any, undefined as any)).toBe('0')
  })

  test('times(10, undefined)', () => {
    expect(times(10, undefined as any)).toBe('0')
  })

  test(`times(undefined, '10')`, () => {
    expect(times(undefined as any, '10')).toBe('0')
  })

  test(`times(16, 16`, () => {
    expect(times(16, 16)).toBe('256')
  })

  test('div(undefined, undefined)', () => {
    expect(div(undefined as any, undefined as any)).toBe('0')
  })

  test('div(10, undefined)', () => {
    expect(div(10, undefined as any)).toBe('10')
  })

  test('div(10, 0)', () => {
    expect(div(10, 0)).toBe('10')
  })

  test('div(10, -1)', () => {
    expect(div(10, -1)).toBe('-10')
  })

  test(`div(undefined, '10')`, () => {
    expect(div(undefined as any, '10')).toBe('0')
  })

  test(`div(256, 16)`, () => {
    expect(div(256, 16)).toBe('16')
  })

  test(`div(256, '16')`, () => {
    expect(div(256, '16')).toBe('16')
  })

  test('isFinite(undefined)', () => {
    expect(isFinite(undefined as any)).toBe(false)
  })

  test('isFinite(NaN))', () => {
    expect(isFinite(NaN)).toBe(false)
  })

  test('isFinite(0)', () => {
    expect(isFinite(0)).toBe(true)
  })

  test('isInteger(undefined)', () => {
    expect(isInteger(undefined as any)).toBe(false)
  })

  test('isInteger(0.1)', () => {
    expect(isInteger(0.1)).toBe(false)
  })

  test('isInteger(0)', () => {
    expect(isInteger(0)).toBe(true)
  })

  test('sum()', () => {
    expect(sum()).toBe('0')
  })

  test(`sum('string')`, () => {
    expect(sum('str')).toBe('0')
  })

  test('sum()', () => {
    expect(sum()).toBe('0')
  })

  test('sum(NaN,1,2,3)', () => {
    expect(sum(NaN, 1, 2, 3)).toBe('6')
  })

  test('sum(10,20,30,3.14)', () => {
    expect(sum(10, 20, 30, 3.14)).toBe('63.14')
  })

  test(`min()`, () => {
    expect(min()).toBe('0')
  })

  test(`min('')`, () => {
    expect(min('')).toBe('0')
  })

  test('min(NaN,1,2,3)', () => {
    expect(min(NaN, 1, 2, 3)).toBe('1')
  })

  test('min(10,20,30,3.14)', () => {
    expect(min(10, 20, 30, 3.14)).toBe('3.14')
  })

  test(`getIntegerPortion('')`, () => {
    expect(getIntegerPortion('')).toBe('NaN')
  })

  test(`getIntegerPortion('1')`, () => {
    expect(getIntegerPortion('1')).toBe('1')
  })

  test(`getIntegerPortion('100.000404020')`, () => {
    expect(getIntegerPortion('100.000404020')).toBe('100')
  })

  test(`getIntegerPortion('-1.1010')`, () => {
    expect(getIntegerPortion('-1.1010')).toBe('-1')
  })
  test('test div by zero', () => {
    expect(div('100', '0')).toBe('Infinity')
  })
})
