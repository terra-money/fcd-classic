import { getRepository, WhereExpression } from 'typeorm'
import { get, filter } from 'lodash'

import { TxEntity } from 'orm'

function addWasmContractFilter(qb: WhereExpression, owner?: string) {
  qb.where(`data->'tx'->'value'->'msg'@>'[{ "type": "wasm/InstantiateContract"}]'`)
  qb.andWhere(`data->'code' is null`)
  if (owner) {
    qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "owner": "${owner}" } }]'`)
  }
}

export async function getContracts(
  page: number,
  limit: number,
  owner?: string
): Promise<{
  totalCnt: number
  page: number
  limit: number
  contracts: Transaction.LcdTransaction[]
}> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx')
  addWasmContractFilter(qb, owner)

  const totalCnt = await qb.getCount()

  qb.skip(limit * (page - 1))
    .take(limit)
    .orderBy(`data->'timestamp'`, 'DESC')

  const result = await qb.getMany()
  return {
    totalCnt,
    page,
    limit,
    contracts: result.map((tx) => tx.data as Transaction.LcdTransaction)
  }
}
