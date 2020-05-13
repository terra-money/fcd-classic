import { format } from 'date-fns'

export function getObjectDateKey(date: Date): string {
  return format(date, 'YYYY-MM-DD')
}
