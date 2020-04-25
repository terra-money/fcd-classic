interface Vesting {
  denom: string
  total: string
  schedules: VestingSchedule[]
}

interface VestingSchedule {
  amount: string
  startTime: number
  endTime: number
  ratio: number
  freedRate: number
}
