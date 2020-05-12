import { startOfDay, subDays } from 'date-fns'
import { getConnection } from 'typeorm'

import { getCountBaseWhereQuery } from 'service/dashboard'

interface AccountCountByDay {
  datetime: string
  totalAccount: number
  activeAccount: number
}

export default async function getAccountCountByDay(daysBefore: number): Promise<AccountCountByDay[]> {
  const baseQuery = `SELECT DATE(datetime) AS datetime, \
MAX(total_account_count) AS totalAccount, \
MAX(active_account_count) AS activeAccount FROM general_info `

  const result: AccountCountByDay[] = await getConnection().query(
    `${baseQuery}${getCountBaseWhereQuery(daysBefore)} GROUP BY DATE(datetime) ORDER BY datetime ASC`
  )

  return result
}
