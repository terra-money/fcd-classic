import { PriceEntity } from 'orm'
import { getRepository } from 'typeorm'
import { startOfMinute } from 'date-fns'

import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { errorReport } from 'lib/errorReporting'
import { timeoutPromise } from 'lib/timeoutPromise'
import { PROMISE_MAX_TIMEOUT_MS } from 'lib/constant'

async function insertPrice(denom: string, price: string) {
  const now = Date.now()
  await getRepository(PriceEntity)
    .save({
      datetime: startOfMinute(now),
      denom,
      price: parseFloat(price)
    })
    .then(() => {
      logger.info(`SavePrice - ${denom}:${price}`)
    })
}

export async function collectPrice() {
  const prices = await lcd.getActiveOraclePrices()
  const promises = Promise.all(Object.keys(prices).map((denom) => insertPrice(denom, prices[denom])))
  await timeoutPromise(promises, PROMISE_MAX_TIMEOUT_MS, 'Failed price in timeout').catch((e) => {
    logger.error(e)
    errorReport(e)
  })
}
