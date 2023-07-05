import 'jest-extended'
import { format, subDays, startOfToday, addMinutes, subMinutes, startOfMinute } from 'date-fns'
import {
  getQueryDateRangeFrom,
  dateFromDateString,
  daysBeforeTs,
  getQueryDateTime,
  getDateRangeOfLastMinute,
  getDateFromDateTime,
  getStartOfPreviousMinuteTs
} from './time'

describe('time', () => {
  test('daysBeforeTs', () => {
    const today = startOfToday()

    expect(daysBeforeTs(1)).toMatchObject({
      fromTs: today.getTime() - 60000 * 60 * 24,
      toTs: today.getTime()
    })
  })

  test('getQueryDateTime', () => {
    expect(getQueryDateTime(Date.now()).toString()).toMatch(format(Date.now(), 'yyyy-MM-dd HH:mm:ss'))
  })

  test('getQueryDateRangeFrom(1)', () => {
    const today = startOfToday()

    expect(getQueryDateRangeFrom(today, 1)).toMatchObject({
      to: format(today, 'yyyy-MM-dd'),
      from: format(subDays(today, 1), 'yyyy-MM-dd')
    })
  })

  test('getDateRangeOfLastMinute', () => {
    const timestamp = startOfMinute(Date.now() - 60000)
    const { from, to } = getDateRangeOfLastMinute(timestamp.getTime())

    expect(from.toString()).toBe(subMinutes(timestamp, 1).toString())
    expect(to.toString()).toBe(startOfMinute(timestamp).toString())
  })

  test('dateFromDateString', () => {
    const d = new Date('2020-04-25')

    expect(dateFromDateString('2020-04-25').toString()).toBe(addMinutes(d, d.getTimezoneOffset()).toString())
  })

  test('getDateFromDateTime', () => {
    const d = new Date('2020-01-30 12:23:11')

    expect(getDateFromDateTime(d)).toBe('2020-01-30')
  })

  test('getPreviousMinutes timestamp', () => {
    const nowTs = new Date().getTime()

    expect(getStartOfPreviousMinuteTs(nowTs)).toBe(subMinutes(startOfMinute(nowTs), 1).getTime())
  })
})
