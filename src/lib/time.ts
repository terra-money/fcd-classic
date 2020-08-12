import { startOfToday, subDays, startOfMinute, subMinutes, format, getTime } from 'date-fns'

export function daysBeforeTs(daysBefore: number = 1): { fromTs: number; toTs: number } {
  const to = startOfToday()

  return {
    fromTs: subDays(to, daysBefore).getTime(),
    toTs: to.getTime()
  }
}

export function getQueryDateTime(timestamp: number | Date): string {
  return format(timestamp, 'YYYY-MM-DD HH:mm:ss')
}

export function getQueryDateRangeFrom(daysBefore: number): DateRange {
  const today = startOfToday()
  return {
    from: format(subDays(today, daysBefore).getTime() || 0, 'YYYY-MM-DD'),
    to: format(today, 'YYYY-MM-DD')
  }
}

export function getDateRangeOfLastMinute(timestamp: number): { from: Date; to: Date } {
  const to = startOfMinute(timestamp)
  const from = subMinutes(to, 1)

  return { from, to }
}

const YYYY_MM_DD_REGEX = /^(\d{4})-(\d{2})-(\d{2})/

export function dateFromDateString(dateString: string) {
  const dateArray: string[] = YYYY_MM_DD_REGEX.exec(dateString) || []
  return new Date(+dateArray[1], +dateArray[2] - 1, +dateArray[3])
}

export function getDateFromDateTime(date: Date): string {
  return format(date, 'YYYY-MM-DD')
}

export function getStartOfPreviousMinuteTs(timestamp: number): number {
  return getTime(subMinutes(startOfMinute(timestamp), 1))
}
