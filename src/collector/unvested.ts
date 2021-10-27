import { orderBy, reverse } from 'lodash'
import * as globby from 'globby'
import * as fs from 'fs'
import { getConnection } from 'typeorm'
import { UnvestedEntity } from 'orm'
import { collectorLogger as logger } from 'lib/logger'

async function generateUnvestedEntities(): Promise<UnvestedEntity[]> {
  const paths = await globby([`/tmp/vesting-*`])
  const recentFile = reverse(orderBy(paths))[0]

  if (!recentFile) {
    return []
  }

  const coins = JSON.parse(fs.readFileSync(recentFile, 'utf8'))

  return coins.map((coin) => {
    const item = new UnvestedEntity()

    item.datetime = new Date()
    item.denom = coin.denom
    item.amount = coin.amount
  })
}

export async function collectUnvested() {
  logger.info('collectUnvested: start')
  const docs = await generateUnvestedEntities()
  await getConnection().manager.save(docs)
  logger.info('collectUnvested: end')
}
