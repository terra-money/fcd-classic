import { PriceEntity } from 'orm'
import { WhereExpression, getRepository, getConnection } from 'typeorm'
import * as moment from 'moment'
import { times, div } from 'lib/math'

export function getUSDValue(denom: string, amount: string, prices: { [key: string]: string }): string {
  let usdValue = '0'
  if ((denom === 'uluna' || prices[denom]) && prices['uusd']) {
    switch (denom) {
      case 'uusd':
        usdValue = amount
        break
      case 'uluna':
        usdValue = times(prices['uusd'], amount)
        break
      default:
        usdValue = div(amount, div(prices[denom], prices['uusd']))
    }
  }
  return usdValue
}

export function addDatetimeFilterToQuery(timestamp: number, qb: WhereExpression) {
  const to = moment(timestamp - (timestamp % 60000)).format('YYYY-MM-DD HH:mm:ss')
  const from = moment(timestamp - (timestamp % 60000) - 60000).format('YYYY-MM-DDTHH:mm:ss')
  qb.andWhere(`timestamp >= '${from}'`)
  qb.andWhere(`timestamp < '${to}'`)
}

export function isSuccessfulMsg(msg) {
  return msg.success
}

export function bulkSave(docs) {
  return getConnection().manager.save(docs)
}

export async function getAllActivePrices(timestamp: number): Promise<{ [denom: string]: string }> {
  const prices = await getRepository(PriceEntity).find({
    datetime: new Date(timestamp)
  })

  return prices.reduce((acc, price) => {
    return { ...acc, [price.denom]: price['price'] }
  }, {})
}
