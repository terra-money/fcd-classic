import * as Bluebird from 'bluebird'
import { getConnection, getRepository } from 'typeorm'
import { orderBy, reverse, chunk } from 'lodash'
import { globby } from 'globby'
import * as fs from 'fs'
import * as byline from 'byline'

import { DenomEntity, RichListEntity } from 'orm'

import { div } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'

import { getTotalSupply } from 'service/treasury'

async function getRichList(denom: string): Promise<RichListEntity[]> {
  logger.info(`Parsing rich list entity from tracking file.`)
  const totalSupply = await getTotalSupply(denom)
  const paths = await globby([`/tmp/tracking-${denom}-*.txt`])
  const recentFile = reverse(orderBy(paths))[0]

  if (!recentFile) {
    return []
  }

  return new Promise((resolve) => {
    const entities: RichListEntity[] = []
    const stream = byline(fs.createReadStream(recentFile, 'utf8'))

    stream.on('data', (line) => {
      const entity = new RichListEntity()
      const [account, amount] = line.split(',')
      entity.denom = denom
      entity.account = account
      entity.amount = amount
      entity.percentage = Number(div(amount, totalSupply))
      entities.push(entity)
    })

    stream.on('end', () => {
      resolve(entities)
    })
  })
}

async function saveRichListByDenom(denom: string) {
  const docs = await getRichList(denom)

  if (docs.length === 0) {
    return
  }

  const mgr = getConnection().manager
  await mgr.delete(RichListEntity, { denom })
  await Bluebird.mapSeries(chunk(docs, 10000), (docs) => mgr.save(docs))
  logger.info(`Saved ${docs.length} richlist for ${denom}`)
}

export async function collectRichList() {
  logger.info('Start saving rich list')
  const denoms = await getRepository(DenomEntity).find({
    active: true
  })

  await Promise.all(denoms.map((denom) => saveRichListByDenom(denom.name)))
  logger.info('Saving rich list done')
}
