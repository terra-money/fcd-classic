import { getRepository } from 'typeorm'
import { DenomEntity, RichListEntity } from 'orm'
import { orderBy, reverse } from 'lodash'
import * as globby from 'globby'
import * as fs from 'fs'

import { div } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'
import { getTotalSupply } from 'service/treasury'
import { bulkSave } from './helper'

function generateRichListEntity(lines: string[], denom: string, totalSupply: string): RichListEntity[] {
  return lines.map((line) => {
    const entity = new RichListEntity()
    const [account, amount] = line.split(',')
    entity.denom = denom
    entity.account = account
    entity.amount = amount
    entity.percentage = Number(div(amount, totalSupply))

    return entity
  })
}

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
    const stream = fs.createReadStream(recentFile, 'utf8')
    // incomplete string contains the incomplete part of a line in data stream
    let incompleteLine = ''
    stream.on('data', (data: string) => {
      const lineString = incompleteLine + data
      const lines = lineString.split('\n').filter(Boolean)

      if (lines.length > 0) {
        // skipped the last line as it might contains incomplete data.
        incompleteLine = lines[lines.length - 1]
        lines.pop()
      }

      if (lines.length > 0) {
        entities.push(...generateRichListEntity(lines, denom, totalSupply))
      }
    })

    stream.on('end', () => {
      if (incompleteLine.length) {
        const lines = incompleteLine.split('\n').filter(Boolean)
        if (lines.length > 0) {
          entities.push(...generateRichListEntity(lines, denom, totalSupply))
        }
      }
      resolve(entities)
    })
  })
}

async function saveRichListByDenom(denom: string) {
  const docs = await getRichList(denom)

  if (docs.length === 0) {
    return
  }

  await getRepository(RichListEntity).delete({ denom })
  await bulkSave(docs)
  logger.info(`Saved ${docs.length} richlist for ${denom}`)
}

export async function saveRichList() {
  logger.info('Start saving rich list')
  const denoms = await getRepository(DenomEntity).find({
    active: true
  })

  await Promise.all(denoms.map((denom) => saveRichListByDenom(denom.name)))
  logger.info('Saving rich list done')
}
