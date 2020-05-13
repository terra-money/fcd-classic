import { startOfDay, subDays, format } from 'date-fns'
import { getConnection } from 'typeorm'

import { getCountBaseWhereQuery } from 'service/dashboard'
import { getDateFromDateTime } from './helpers'

export interface AccountCountInfo {
  totalAccount: number
  activeAccount: number
}

export async function getAccountCountByDay(daysBefore?: number): Promise<{ [date: string]: AccountCountInfo }> {
  const baseQuery = `SELECT DATE(datetime) AS datetime, \
MAX(total_account_count) AS total_account, \
MAX(active_account_count) AS active_account FROM general_info `

  const result: {
    total_account: number
    active_account: number
    datetime: string
  }[] = await getConnection().query(
    `${baseQuery}${getCountBaseWhereQuery(daysBefore)} GROUP BY DATE(datetime) ORDER BY datetime ASC`
  )

  return result.reduce((acc, item) => {
    acc[getDateFromDateTime(new Date(item.datetime))] = {
      totalAccount: item.total_account,
      activeAccount: item.active_account
    }
    return acc
  }, {})
}
