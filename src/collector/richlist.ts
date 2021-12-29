import * as Bluebird from 'bluebird'
import { getConnection } from 'typeorm'
import { orderBy, reverse, chunk } from 'lodash'
import * as globby from 'globby'
import * as fs from 'fs'
import * as byline from 'byline'

import { RichListEntity } from 'orm'

import { div } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'

import { getTotalSupply } from 'service/treasury'

async function generateRichListEntities(denom: string, path: string): Promise<RichListEntity[]> {
  logger.info(`Generating rich list from ${path} for ${denom}`)
  const totalSupply = await getTotalSupply(denom)

  return new Promise((resolve) => {
    const entities: RichListEntity[] = []
    const stream = byline(fs.createReadStream(path, 'utf8'))

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

export async function collectRichList() {
  logger.info('collectRichList: start')

  // Find the latest tracking file
  const recentFilePath = reverse(orderBy(await globby([`/tmp/tracking-*.txt`])))[0]

  if (!recentFilePath) {
    return
  }

  const extractRegex = /tracking-([a-z]+)-(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/
  const res = extractRegex.exec(recentFilePath)

  if (!res) {
    throw new Error(`cannot parse ${recentFilePath}`)
  }

  // Find tracking files which has same timestamp as the latest tracking file
  const timestamp = res[2]
  const paths = await globby([`/tmp/tracking-*-${timestamp}.txt`])

  const mgr = getConnection().manager

  // For each tracking file
  await Promise.all(
    paths.map(async (path) => {
      const res = extractRegex.exec(path)

      if (!res || !res[1]) {
        logger.error(`cannot parse ${path}`)
        return
      }

      // Generate entities
      const denom = res[1]
      const entities = await generateRichListEntities(denom, path)

      // Replace
      await mgr.delete(RichListEntity, { denom })
      await Bluebird.mapSeries(chunk(entities, 10000), (docs) => mgr.save(docs))
      logger.info(`Saved ${entities.length} richlist for ${denom}`)
    })
  )

  logger.info('collectRichList: end')
}
