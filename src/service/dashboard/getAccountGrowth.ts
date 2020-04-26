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
  const baseQuery = `select date(datetime) as datetime, max(total_account_count) as total_account_count, max(active_account_count) as active_account_count from general_info `
  const today = startOfDay(Date.now())
  let dateQuery = `where datetime < '${getQueryDateTime(today)}'`

  if (daysBefore) {
    dateQuery = `${dateQuery} and datetime >= '${getQueryDateTime(subDays(today, Math.max(1, daysBefore)))}'`
  }

  return dashboardRawQuery(`${baseQuery}${dateQuery} group by date(datetime) order by date(datetime) asc`)
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
