import { parseISO, format, startOfDay } from 'date-fns'
import { getConnection } from 'typeorm'

export const getPriceObjKey = (date: Date | string, denom: string) => {
  if (typeof date === 'string') {
    return `${format(parseISO(date), 'yyyy-MM-dd')}${denom}`
  } else if (date instanceof Date) {
    return `${format(date, 'yyyy-MM-dd')}${denom}`
  }

  throw TypeError('unknown date type')
}

export const convertDbTimestampToDate = (columnName: string) =>
  `TO_CHAR(DATE_TRUNC('day', ${columnName}), 'YYYY-MM-DD')`

async function getMaxDateOfDbTable(tableName: string, columnName: string): Promise<Date> {
  const queryStr = `SELECT MAX(${columnName}) as data_until_date from ${tableName}`
  const result = await getConnection().query(queryStr)
  return startOfDay(result[0].data_until_date)
}

export async function getLatestDateOfGeneralInfo(): Promise<Date> {
  return getMaxDateOfDbTable('general_info', 'datetime')
}

export async function getLatestDateOfAccountTx(): Promise<Date> {
  return getMaxDateOfDbTable('account_tx', 'timestamp')
}

export async function getLatestDateOfReward(): Promise<Date> {
  return getMaxDateOfDbTable('reward', 'datetime')
}

export async function getLatestDateOfNetwork(): Promise<Date> {
  return getMaxDateOfDbTable('network', 'datetime')
}
