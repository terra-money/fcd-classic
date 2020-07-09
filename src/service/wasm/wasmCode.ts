import { getRepository, WhereExpression } from 'typeorm'

import { TxEntity } from 'orm'

function addWasmCodeFilter(qb: WhereExpression, sender?: string) {
  qb.where(`data->'tx'->'value'->'msg'@>'[{ "type": "wasm/StoreCode"}]'`)
  qb.andWhere(`data->'code' is null`)
  if (sender) {
    qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "sender": "${sender}" } }]'`)
  }
}

export async function getWasmCodes(
  page: number,
  limit: number,
  sender?: string
): Promise<{
  totalCnt: number
  page: number
  limit: number
  codes: Transaction.LcdTransaction[]
}> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx')
  addWasmCodeFilter(qb, sender)

  const totalCnt = await qb.getCount()

  qb.skip(limit * (page - 1))
    .take(limit)
    .orderBy(`data->'timestamp'`, 'DESC')

  const result = await qb.getMany()
  return {
    totalCnt,
    page,
    limit,
    codes: result.map((tx) => tx.data as Transaction.LcdTransaction)
  }
}
