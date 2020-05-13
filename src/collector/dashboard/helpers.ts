import { format } from 'date-fns'

export function getDateFromDateTime(date: Date): string {
  return format(date, 'YYYY-MM-DD')
}

export const getPriceObjKey = (date: Date, denom: string) => `${format(date, 'YYYY-MM-DD')}${denom}`
