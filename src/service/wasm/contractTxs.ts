import { getRepository, WhereExpression } from 'typeorm'

import { TxEntity } from 'orm'

type GetContractTxsParams = {
  page: number
  limit: number
  contract_address: string
  sender?: string
}

function addWasmContractTxFilter(qb: WhereExpression, contractAddress: string, sender?: string) {
  qb.where(`data->'tx'->'value'->'msg'@>'[{ "type": "wasm/ExecuteContract"}]'`)
  qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "contract": "${contractAddress}" } }]'`)
  if (sender) {
    qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "sender": "${sender}" } }]'`)
  }
}

export async function getContractTxs({
  page,
  limit,
  sender,
  contract_address
}: GetContractTxsParams): Promise<{
  total: number
  page: number
  limit: number
  contractTxs: Transaction.LcdTransaction[]
}> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx')
  addWasmContractTxFilter(qb, contract_address, sender)

  const total = await qb.getCount()

  qb.skip(limit * (page - 1))
    .take(limit)
    .orderBy(`data->'timestamp'`, 'DESC')

  const result = await qb.getMany()
  return {
    total,
    page,
    limit,
    contractTxs: result.map((tx) => tx.data as Transaction.LcdTransaction)
  }
}
