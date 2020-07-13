import { getRepository } from 'typeorm'
import { DenomEntity, RichListEntity } from 'orm'
import { orderBy, reverse, get, chain } from 'lodash'
import * as globby from 'globby'
import * as fs from 'fs'

import { div } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'

import { getTotalSupply } from 'service/treasury'
import { bulkSave } from './helper'

function accountAmountMapper(denom: string, total: string) {
  return (account) => {
    const item = new RichListEntity()
    const amount = get(account, 'amount')

    if (!account || !amount || amount === '0') {
      return
    }

    item.denom = denom
    item.account = get(account, 'address')
    item.amount = amount
    item.percentage = Number(div(amount, total))
    return item
  }
}

async function getRichList(denom: string): Promise<RichListEntity[] | undefined> {
  const totalSupply = await getTotalSupply(denom)
  const paths = await globby([`/tmp/tracking-${denom}-*`])
  const recentFile = reverse(orderBy(paths))[0]

  if (!recentFile) {
    return
  }

  const accountsString = fs.readFileSync(recentFile, 'utf8')
  const accounts = JSON.parse(accountsString)
  return chain(accounts.map(accountAmountMapper(denom, totalSupply)))
    .compact()
    .orderBy(['amount'], ['desc'])
    .value()
}

async function saveRichList(denom: string) {
  const docs = await getRichList(denom)

  if (!docs || docs.length === 0) {
    return
  }

  await getRepository(RichListEntity).delete({ denom })
  await bulkSave(docs)
}

export default async function setRichList() {
  const denoms = await getRepository(DenomEntity).find({
    active: true
  })
  await Promise.all(denoms.map((denom) => saveRichList(denom.name)))
  logger.info(`Save richlist - success.`)
}
