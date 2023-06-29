import { BOND_DENOM } from 'lib/constant'
import { plus, minus, times, div, sum, min } from 'lib/math'

/* utils */
const concat = <T>(a: T[], b: T[]): T[] => [...a, ...b]

/* helpers */
type ConvertCoins = (array?: Coins) => DenomMap

export const convertCoins: ConvertCoins = (array) => {
  const reducer = (acc: object, { amount, denom }: Coin) => {
    return { ...acc, [denom]: amount }
  }
  return Array.isArray(array) ? array.reduce(reducer, {}) : {}
}

export type ConvertedSchedule = {
  startTime: number
  endTime: number
  ratio: number
}

type ConvertedSchedulesByDenom = { [denom: string]: ConvertedSchedule[] }

export function convertSchedules(array?: VestingSchedules[]): ConvertedSchedulesByDenom {
  const reducer = (acc: object, { schedules, denom }: VestingSchedules) => {
    const mapSchedule = ({ start_time, end_time, ratio }: Schedule) => ({
      startTime: Number(start_time) * 1000,
      endTime: Number(end_time) * 1000,
      ratio: Number(ratio)
    })
    return { ...acc, [denom]: schedules.map(mapSchedule) }
  }
  return Array.isArray(array) ? array.reduce(reducer, {}) : {}
}

const calculate = (account: NormalizedAccount, unbondings: any[], latestBlockTimestamp: number): Balance[] => {
  /* normailze */
  const { coins, vesting_schedules } = account
  const { original_vesting, delegated_vesting } = account

  /* map */
  const originalVestingMap = convertCoins(original_vesting)
  // const delegatedFreeMap = convertCoins(delegated_free)
  const delegatedVestingMap = convertCoins(delegated_vesting)
  const scheduleMap = convertSchedules(vesting_schedules)

  /* wallet */
  const reducer = (acc: Balance[], { amount, denom }: Coin) => {
    /* helpers */
    const reduceFreedRate = (acc: string, s: ConvertedSchedule): string => {
      const freedRate = div(minus(min([s.endTime, latestBlockTimestamp]), s.startTime), minus(s.endTime, s.startTime))
      return plus(acc, Number(freedRate) > 0 ? times(freedRate, s.ratio) : 0)
    }

    /* determinant */
    const isLuna = denom === BOND_DENOM
    const isVested = isLuna || denom === 'usdr'

    /* terms */
    // const delegationAmount = delegations ? delegations.map((d) => d.amount) : []
    const unbondingBalances = unbondings
      ? unbondings.map((u) => u.entries.map((e) => e.balance)).reduce(concat, [])
      : []

    const originalVesting = originalVestingMap[denom] || '0'
    const delegatedVesting = delegatedVestingMap[denom] || '0'
    // const delegatedFree = delegated_free ? delegatedFreeMap[denom] : isLuna ? sum(delegationAmount) : '0'

    const schedule = scheduleMap[denom] || []
    const freedRate = schedule.reduce(reduceFreedRate, '0')
    const freedVesting = times(originalVesting, freedRate)

    /* calculation */
    const vesting = isVested ? minus(originalVesting, freedVesting) : '0'
    const unbonding = isLuna && unbondings && unbondings.length > 0 ? sum(unbondingBalances) : '0'
    // const delegated = isLuna ? plus(sum(delegationAmount), unbonding) : '0'

    /* required */
    // const total = sum([amount, delegatedVesting, delegatedFree])
    const available = min([amount, sum([amount, delegatedVesting, -vesting])])

    const delegatable = denom === BOND_DENOM ? amount : '0'

    return acc.concat({
      denom,
      available,
      delegatedVesting,
      delegatable,
      freedVesting,
      unbonding,
      remainingVesting: minus(originalVesting, freedVesting)
    })
  }

  const available: Balance[] = Array.isArray(coins) ? coins.reduce(reducer, []) : []

  return available
}

export default calculate
