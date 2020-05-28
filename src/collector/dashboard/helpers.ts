import { format } from 'date-fns'

export const getPriceObjKey = (date: Date, denom: string) => `${format(date, 'YYYY-MM-DD')}${denom}`

export const convertDbTimestampToDate = (columnName: string) =>
  `TO_CHAR(DATE_TRUNC('day', ${columnName}), 'YYYY-MM-DD')`
