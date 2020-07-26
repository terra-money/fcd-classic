import { getRepository } from 'typeorm'
import { DenomEntity, RichListEntity } from 'orm'
import { orderBy, reverse } from 'lodash'
import * as globby from 'globby'
import * as fs from 'fs'

import { div } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'
import { getTotalSupply } from 'service/treasury'
import { bulkSave } from './helper'

async function getRichList(denom: string): Promise<RichListEntity[]> {
  const totalSupply = await getTotalSupply(denom)
  const paths = await globby([`/tmp/tracking-${denom}-*.txt`])
  const recentFile = reverse(orderBy(paths))[0]

  if (!recentFile) {
    return []
  }

  return new Promise((resolve) => {
    const entities: RichListEntity[] = []
    const stream = fs.createReadStream(recentFile, 'utf8')

    stream.on('data', (data: string) => {
      const lines = data.split('\n').filter(Boolean)

      entities.push(
        ...lines.map((line) => {
          const entity = new RichListEntity()
          const [account, amount] = line.split(',')

          entity.denom = denom
          entity.account = account
          entity.amount = amount
          entity.percentage = Number(div(amount, totalSupply))

          return entity
        })
      )
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

  await getRepository(RichListEntity).delete({ denom })
  await bulkSave(docs)
  logger.info(`Saved ${docs.length} richlist for ${denom}`)
}

export async function saveRichList() {
  const denoms = await getRepository(DenomEntity).find({
    active: true
  })

  await Promise.all(denoms.map((denom) => saveRichListByDenom(denom.name)))
}
