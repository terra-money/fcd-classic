import { startOfToday, subDays, startOfMinute, subMinutes, format } from 'date-fns'

export function getTargetDates(daysBefore: number): Date[] {
  const targets: Date[] = []
  const today = startOfToday()

  targets.push(today)

  for (let i = 0; i < daysBefore - 1; i = i + 1) {
    targets.push(subDays(today, i))
  }

  return targets
}

export function daysBeforeTs(daysBefore: number = 1): { fromTs: number; toTs: number } {
  const to = startOfToday()

  return {
    fromTs: subDays(to, 1).getTime(),
    toTs: to.getTime()
  }
}

export function getQueryDateTime(timestamp: number | Date): string {
  return format(timestamp, 'YYYY-MM-DD HH:mm:ss')
}

export function getQueryDateRangeFrom(daysBefore: number): DateRange {
  const today = startOfToday()

  return {
    from: format(subDays(today, daysBefore), 'YYYY-MM-DD'),
    to: format(today, 'YYYY-MM-DD')
  }
}

export function getDateRangeOfLastMinute(timestamp: number): { from: Date; to: Date } {
  const to = startOfMinute(timestamp)
  const from = subMinutes(to, 1)

  return { from, to }
}

const YYYY_MM_DD_REGEX = /(\d{4})-(\d{2})-(\d{2})/

export function dateFromDateString(dateString: string) {
  const dateArray: string[] = YYYY_MM_DD_REGEX.exec(dateString) || []
  return new Date(+dateArray[1], +dateArray[2] - 1, +dateArray[3])
}
