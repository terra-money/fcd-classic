import { parseISO, format } from 'date-fns'

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
