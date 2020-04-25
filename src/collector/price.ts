import { PriceEntity } from 'orm'
import { getRepository } from 'typeorm'

import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { errorReport } from 'lib/errorReporting'

async function insertPrice(denom: string, price: string) {
  const now = Date.now()
  await getRepository(PriceEntity)
    .save({
      datetime: new Date(now - (now % 60000)),
      denom,
      price: parseFloat(price)
    })
    .then(() => {
      logger.info(`SavePrice - ${denom}:${price}`)
    })
}

export async function setPrices() {
  const prices = await lcd.getActiveOraclePrices()
  await Promise.all(Object.keys(prices).map((denom) => insertPrice(denom, prices[denom]))).catch((e) => {
    logger.error(e)
    errorReport(e)
  })
}
