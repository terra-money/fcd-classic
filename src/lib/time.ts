import { startOfToday, subDays, startOfMinute, subMinutes, format } from 'date-fns'

export function daysBeforeTs(daysBefore = 1): { fromTs: number; toTs: number } {
  const to = startOfToday()

  return {
    fromTs: subDays(to, daysBefore).getTime() || 0,
    toTs: to.getTime()
  }
}

export function getQueryDateTime(timestamp: number | Date): string {
  return format(timestamp, 'yyyy-MM-dd HH:mm:ss')
}

export function getQueryDateRangeFrom(daysBefore: number) {
  const today = startOfToday()
  return {
    from: format(subDays(today, daysBefore).getTime() || 0, 'yyyy-MM-dd'),
    to: format(today, 'yyyy-MM-dd')
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
  return format(date, 'yyyy-MM-dd')
}

export function getStartOfPreviousMinuteTs(timestamp: number): number {
  return subMinutes(startOfMinute(timestamp), 1).getTime()
}
