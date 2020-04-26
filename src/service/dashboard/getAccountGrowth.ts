import { dashboardRawQuery } from './helper'
import { compact } from 'lodash'
import { startOfDay, subDays, getTime } from 'date-fns'
import { getQueryDateTime } from 'lib/time'

export interface GetAccountGrowthParam {
  count?: number
}

interface RawAccountCount {
  total_account_count: number
  active_account_count: number
  datetime: string
}

async function getAccountHistory(daysBefore?: number): Promise<RawAccountCount[]> {
  const baseQuery = `SELECT DATE(datetime) AS datetime, \
MAX(total_account_count) AS total_account_count, \
MAX(active_account_count) AS active_account_count FROM general_info `
  const today = startOfDay(Date.now())
  let dateQuery = `WHERE datetime < '${getQueryDateTime(today)}'`

  if (daysBefore) {
    dateQuery = `${dateQuery} AND datetime >= '${getQueryDateTime(subDays(today, Math.max(1, daysBefore)))}'`
  }

  return dashboardRawQuery(`${baseQuery}${dateQuery} GROUP BY DATE(datetime) ORDER BY datetime ASC`)
}

export default async function getAccountGrowth(count?: number): Promise<AccountGrowthReturn> {
  const accountHistory = await getAccountHistory(count)

  const cumulative = accountHistory.map((item) => {
    return {
      datetime: getTime(new Date(item.datetime)),
      totalAccountCount: item.total_account_count,
      activeAccountCount: item.active_account_count
    }
  })

  const periodic: AccountCountInfo[] = compact(
    accountHistory.map((item, i) => {
      if (i === 0) {
        return
      }

      return {
        datetime: getTime(new Date(item.datetime)),
        totalAccountCount: item.total_account_count - accountHistory[i - 1].total_account_count,
        activeAccountCount: item.active_account_count - accountHistory[i - 1].active_account_count
      }
    })
  )

  return {
    cumulative: cumulative.slice(1),
    periodic
  }
}
