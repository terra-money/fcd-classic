import { getRepository, WhereExpressionBuilder } from 'typeorm'

import { TxEntity } from 'orm'

type GetContractTxsParams = {
  offset: number
  limit: number
  contractAddress: string
  sender?: string
}

function addWasmContractTxFilter(qb: WhereExpressionBuilder, contractAddress: string, sender?: string) {
  qb.where(`data->'tx'->'value'->'msg'@>'[{ "type": "wasm/ExecuteContract"}]'`)
  qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "contract": "${contractAddress}" } }]'`)
  if (sender) {
    qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "sender": "${sender}" } }]'`)
  }
}

export async function getContractTxs({ offset, limit, sender, contractAddress }: GetContractTxsParams): Promise<{
  next?: number
  limit: number
  contractTxs: Transaction.LcdTransaction[]
}> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx')

  if (offset) {
    qb.where(`id < :offset`, { offset })
  }

  addWasmContractTxFilter(qb, contractAddress, sender)

  qb.take(limit + 1).orderBy('timestamp', 'DESC')

  const result = await qb.getMany()

  let next

  // we have next result
  if (limit + 1 === result.length) {
    next = result[limit - 1].id
    result.length -= 1
  }

  return {
    next,
    limit,
    contractTxs: result.map((tx) => tx.data as Transaction.LcdTransaction)
  }
}
