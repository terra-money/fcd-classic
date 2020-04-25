import { dashboardRawQuery } from './helper'
import { compact } from 'lodash'
import { startOfDay, format, subDays, getTime } from 'date-fns'

export interface GetAccountGrowthParam {
  count?: number
}

interface RawAccountCount {
  total_account_count: number
  active_account_count: number
  datetime: string
}

async function getAccountHistory(count?: number): Promise<RawAccountCount[]> {
  const baseQuery = `select date(datetime) as datetime, max(total_account_count) as total_account_count, max(active_account_count) as active_account_count from general_info `
  const today = startOfDay(new Date())
  let dateQuery = `where datetime < '${format(today, 'YYYY-MM-DD HH:mm:ss')}'`
  if (count) dateQuery = `${dateQuery} and datetime >= '${format(subDays(today, count + 1), 'YYYY-MM-DD HH:mm:ss')}'`

  return dashboardRawQuery(`${baseQuery}${dateQuery} group by date(datetime) order by date(datetime) asc`)
}

export default async function getAccountGrowth(option: GetAccountGrowthParam): Promise<AccountGrowthReturn> {
  const { count } = option

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
