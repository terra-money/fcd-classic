import { EntityManager } from 'typeorm'
import { PriceEntity } from 'orm'
import * as lcd from 'lib/lcd'
import { getStartOfPreviousMinuteTs } from 'lib/time'
import { collectorLogger as logger } from 'lib/logger'

export async function collectPrice(mgr: EntityManager, timestamp: number, strHeight: string) {
  const prices = await lcd.getActiveOraclePrices(strHeight)
  const datetime = new Date(getStartOfPreviousMinuteTs(timestamp))

  const entities = Object.keys(prices).map((denom) => {
    const ent = new PriceEntity()

    ent.datetime = datetime
    ent.denom = denom
    ent.price = parseFloat(prices[denom])

    return ent
  })

  await mgr.insert(PriceEntity, entities)

  logger.info(`collectPrice: ${datetime} ${entities.map((ent) => `${ent.price}${ent.denom}`).join()}`)
}
