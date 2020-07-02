import { getRepository, WhereExpression } from 'typeorm'
import { filter, get } from 'lodash'

import { TxEntity } from 'orm'

type WasmCodeInfo = {
  txhash: string
  timestamp: string
  sender: string
  code_id?: string
}

function addWasmCodeFilter(qb: WhereExpression, sender?: string) {
  qb.where(`data->'tx'->'value'->'msg'@>'[{ "type": "wasm/StoreCode"}]'`)
  qb.andWhere(`data->'code' is null`)
  if (sender) {
    qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "sender": "${sender}" } }]'`)
  }
}

function getCodeInfo(tx: TxEntity): WasmCodeInfo {
  const msgs: Transaction.Message[] = get(tx.data, 'tx.value.msg')
  const msg: Transaction.Message[] = filter(msgs, { type: 'wasm/StoreCode' })
  const sender = msg && msg.length ? get(msg[0], 'value.sender') : ''
  const info = {
    txhash: tx.hash,
    timestamp: tx.timestamp.toISOString(),
    sender
  }

  const logs: Transaction.Log[] = get(tx.data, 'logs')
  if (!logs || logs.length === 0) return info

  const event: Transaction.Event[] = filter(logs[0].events, { type: 'store_code' })

  const attributeObj =
    event && event.length
      ? event[0].attributes.reduce((acc, attr) => {
          acc[attr.key] = attr.value
          return acc
        }, {})
      : {}

  return {
    ...info,
    ...attributeObj
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
  codes: WasmCodeInfo[]
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
    codes: result.map((tx) => getCodeInfo(tx))
  }
}
