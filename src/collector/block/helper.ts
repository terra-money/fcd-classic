import { WhereExpressionBuilder } from 'typeorm'
import { times, div } from 'lib/math'
import { getDateRangeOfLastMinute, getQueryDateTime } from 'lib/time'
import { BOND_DENOM } from 'lib/constant'

export function getUSDValue(denom: string, amount: string, prices: DenomMap): string {
  let usdValue = '0'
  if ((denom === BOND_DENOM || prices[denom]) && prices['uusd']) {
    switch (denom) {
      case 'uusd':
        usdValue = amount
        break
      case BOND_DENOM:
        usdValue = times(prices['uusd'], amount)
        break
      default:
        usdValue = div(amount, div(prices[denom], prices['uusd']))
    }
  }
  return usdValue
}

export function addDatetimeFilterToQuery(timestamp: number, qb: WhereExpressionBuilder) {
  const { from, to } = getDateRangeOfLastMinute(timestamp)

  qb.andWhere(`timestamp >= '${getQueryDateTime(from)}'`)
  qb.andWhere(`timestamp < '${getQueryDateTime(to)}'`)
}
