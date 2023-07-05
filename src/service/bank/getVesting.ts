import { convertCoins, convertSchedules, ConvertedSchedule } from './calculate'
import { minus, times, div, min } from 'lib/math'

const getVesting = (account: NormalizedAccount, latestBlockTimestamp: number): Vesting[] => {
  const { vesting_schedules, original_vesting } = account

  const originalVestingMap = convertCoins(original_vesting)
  const scheduleMap = convertSchedules(vesting_schedules)

  const vestingMapper = (denom: string): Vesting => {
    const originalVesting = originalVestingMap[denom] || '0'
    const schedules = scheduleMap[denom] || []
    const scheduleMappper = (schedule: ConvertedSchedule): VestingSchedule => {
      const freedRate = div(
        minus(min(schedule.endTime, latestBlockTimestamp), schedule.startTime),
        minus(schedule.endTime, schedule.startTime)
      )
      return {
        amount: times(originalVesting, schedule.ratio),
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        ratio: schedule.ratio,
        freedRate: Number(freedRate) > 0 ? Number(freedRate) : 0
      }
    }

    return {
      denom,
      total: originalVesting,
      schedules: schedules.map(scheduleMappper)
    }
  }
  const vestedDenoms = original_vesting ? original_vesting.map((item) => item.denom) : []
  const vesting: Vesting[] = vestedDenoms.map(vestingMapper)

  return vesting
}

export default getVesting
