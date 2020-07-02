import { getRepository, WhereExpression } from 'typeorm'
import { get, filter } from 'lodash'

import { TxEntity } from 'orm'

type ContractInfo = {
  owner: string
  code_id: string
  init_msg: string
  txhash: string
  timestamp: string
}

function addWasmContractFilter(qb: WhereExpression, owner?: string) {
  qb.where(`data->'tx'->'value'->'msg'@>'[{ "type": "wasm/InstantiateContract"}]'`)
  qb.andWhere(`data->'code' is null`)
  if (owner) {
    qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "owner": "${owner}" } }]'`)
  }
}

function getContractInfo(tx: TxEntity): ContractInfo {
  const msgs: Transaction.Message[] = get(tx.data, 'tx.value.msg')
  const msg: Transaction.Message[] = filter(msgs, { type: 'wasm/InstantiateContract' })
  const valueObj = msg && msg.length ? get(msg[0], 'value') : {}
  const { owner, code_id, init_msg } = valueObj

  const info = {
    owner,
    code_id,
    init_msg: Buffer.from(init_msg, 'base64').toString(),
    txhash: tx.hash,
    timestamp: tx.timestamp.toISOString()
  }

  const logs: Transaction.Log[] = get(tx.data, 'logs')
  if (!logs || logs.length === 0) return info

  const events: Transaction.Event[] = filter(logs[0].events, { type: 'instantiate_contract' })

  if (!events || events.length === 0) return info
  const attributeObj = events[0].attributes.reduce((acc, attr) => {
    acc[attr.key] = attr.value
    return acc
  }, {})

  return {
    ...info,
    ...attributeObj
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
  contracts: ContractInfo[]
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
    contracts: result.map((tx) => getContractInfo(tx))
  }
}
