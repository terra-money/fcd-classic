import { getRepository, Brackets, WhereExpressionBuilder } from 'typeorm'
import { get, compact } from 'lodash'
import { TxEntity } from 'orm'
import { isSuccessfulTx } from 'lib/tx'

interface DelegationTxsParam {
  operatorAddr: string // operator address
  limit?: number // tx count limit per page
  offset?: number // for pagination
  from?: number // timestamp ms from
  to?: number // timestamp ms to
}

interface DelegationEvent {
  id: number
  chainId: string
  height: string
  txhash: string
  type: string
  amount: Coin
  timestamp: string
}

interface DelegationTxsReturn {
  events: DelegationEvent[]
  next?: number
  limit?: number // tx count per page
}

function addDelegateFilterToQuery(qb: WhereExpressionBuilder, operatorAddress: string) {
  qb.andWhere(
    new Brackets((q) => {
      q.andWhere(
        new Brackets((qinner) => {
          qinner
            .where(`data->'code' IS NULL`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgDelegate"}]'`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
        })
      )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .where(`data->'code' IS NULL`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgCreateValidator"}]'`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
          })
        )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .where(`data->'code' IS NULL`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgBeginRedelegate"}]'`)
              .andWhere(
                `data->'tx'->'value'->'msg'@>'[{ "value": { "validator_src_address": "${operatorAddress}" } }]'`
              )
          })
        )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .where(`data->'code' IS NULL`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgBeginRedelegate"}]'`)
              .andWhere(
                `data->'tx'->'value'->'msg'@>'[{ "value": { "validator_dst_address": "${operatorAddress}" } }]'`
              )
          })
        )
        .orWhere(
          new Brackets((qinner) => {
            qinner
              .where(`data->'code' IS NULL`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "staking/MsgUndelegate"}]'`)
              .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
          })
        )
    })
  )
}

async function queryRawDelegationTxs(param: DelegationTxsParam): Promise<{
  txs: (Transaction.LcdTransaction & { id: number; chainId: string })[]
  next?: number
}> {
  const qb = getRepository(TxEntity)
    .createQueryBuilder('tx')
    .select(['tx.id', 'tx.chainId', 'tx.data'])
    .orderBy('timestamp', 'DESC')

  if (param.limit) {
    qb.take(param.limit + 1)
  }

  if (param.offset) {
    qb.where(`id < :offset`, { offset: param.offset })
  }

  if (param.from) {
    qb.andWhere(`timestamp >= :from`, { from: new Date(param.from) })
  }

  if (param.to) {
    qb.andWhere(`timestamp < :to`, { to: new Date(param.to) })
  }

  addDelegateFilterToQuery(qb, param.operatorAddr)

  const txs = await qb.getMany()
  let next

  // we have next result
  if (param.limit && param.limit + 1 === txs.length) {
    next = txs[param.limit - 1].id
    txs.length -= 1
  }

  return {
    next,
    txs: txs.map((tx) => ({ ...tx.data, id: tx.id, chainId: tx.chainId }))
  }
}

function extractEvents(
  tx: Transaction.LcdTransaction & { id: number; chainId: string },
  valOpAddr: string
): DelegationEvent[] {
  const msgs = get(tx, 'tx.value.msg')
  const { id, chainId, height, timestamp, txhash } = tx

  return compact(
    msgs.map((msg) => {
      switch (msg.type) {
        case 'staking/MsgDelegate': {
          if (get(msg, 'value.validator_address') !== valOpAddr) {
            return
          }

          const type = 'Delegate'
          const amount = {
            denom: get(msg, 'value.amount.denom'),
            amount: get(msg, 'value.amount.amount')
          }
          return { id, chainId, height, txhash, type, amount, timestamp }
        }
        case 'staking/MsgCreateValidator': {
          if (get(msg, 'value.validator_address') !== valOpAddr) {
            return
          }

          const type = 'Create Validator'
          const amount = {
            denom: get(msg, 'value.value.denom'),
            amount: get(msg, 'value.value.amount')
          }
          return { id, chainId, height, txhash, type, amount, timestamp }
        }
        case 'staking/MsgBeginRedelegate': {
          const srcAddr = get(msg, 'value.validator_src_address')
          const dstAddr = get(msg, 'value.validator_dst_address')
          if (srcAddr !== valOpAddr && dstAddr !== valOpAddr) {
            return
          }

          const type = 'Redelegate'
          let amt = get(msg, 'value.amount.amount')

          if (srcAddr === valOpAddr && amt) {
            amt = `-${amt}`
          }

          const amount = {
            denom: 'uluna',
            amount: amt
          }
          return { id, chainId, height, txhash, type, amount, timestamp }
        }
        case 'staking/MsgUndelegate': {
          if (get(msg, 'value.validator_address') !== valOpAddr) {
            return
          }

          const type = 'Undelegate'
          const amount = {
            denom: get(msg, 'value.amount.denom'),
            amount: `-${get(msg, 'value.amount.amount')}`
          }
          return { id, chainId, height, txhash, type, amount, timestamp }
        }
      }
    })
  )
}

export async function getDelegationTxs(param: DelegationTxsParam): Promise<DelegationTxsReturn> {
  const { next, txs } = await queryRawDelegationTxs(param)

  const events = txs
    .filter(isSuccessfulTx)
    .map((tx) => extractEvents(tx, param.operatorAddr))
    .flat()
    .filter(Boolean)

  return {
    next,
    limit: param.limit,
    events
  }
}
