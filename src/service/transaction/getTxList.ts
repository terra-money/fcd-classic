import { get, chain } from 'lodash'
import { getRepository, getConnection, FindConditions } from 'typeorm'

import { BlockEntity, AccountEntity, TxEntity } from 'orm'
import config from 'config'

import { getQueryDateTime } from 'lib/time'
import parseTx from './parseTx'

export interface GetTxListParam {
  account?: string
  block?: string
  memo?: string
  action?: string
  limit: number
  page: number
  from?: number
  to?: number
  order?: string
  chainId?: string
}
interface GetTxsReturn {
  totalCnt: number
  page: number
  limit: number
  txs: ParsedTxInfo[] | Transaction.LcdTransaction[]
}

export async function getTxFromMemo(param: GetTxListParam): Promise<GetTxsReturn> {
  if (!param.memo) {
    throw new Error(`memo is required.`)
  }

  const order: 'ASC' | 'DESC' = param.order && param.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  const qb = getRepository(TxEntity)
    .createQueryBuilder()
    .where(`data->'tx'->'value'->>'memo' = :memo`, { memo: param.memo })
    .orderBy(`timestamp`, order)
    .offset((param.page - 1) * param.limit)
    .limit(param.limit)

  if (param.from) {
    qb.andWhere('timestamp >= :from', { from: getQueryDateTime(param.from) })
  }

  if (param.to) {
    qb.andWhere('timestamp <= :to', { to: getQueryDateTime(param.to) })
  }

  const [txs, total] = await qb.getManyAndCount()

  return {
    totalCnt: total,
    page: param.page,
    limit: param.limit,
    txs: txs.map((tx) => tx.data as Transaction.LcdTransaction)
  }
}

export async function getTxFromBlock(param: GetTxListParam): Promise<GetTxsReturn> {
  const where: FindConditions<BlockEntity> = {}

  if (param.block) {
    where.height = +param.block
  }

  if (param.chainId) {
    where.chainId = param.chainId
  }

  const blocksWithTxs = await getRepository(BlockEntity).find({
    where,
    order: {
      id: 'DESC'
    },
    relations: ['txs'],
    skip: 0,
    take: 1
  })
  const blockWithTxs = blocksWithTxs.length > 0 ? blocksWithTxs[0] : undefined

  const txs: Transaction.LcdTransaction[] = blockWithTxs
    ? blockWithTxs.txs.map((item) => item.data as Transaction.LcdTransaction)
    : []
  const offset = param.limit * (param.page - 1)

  return {
    totalCnt: txs.length,
    page: param.page,
    limit: param.limit,
    txs: chain(txs).drop(offset).take(param.limit).value()
  }
}

async function getTxTotalCount(data: GetTxListParam): Promise<number> {
  if (!data.from && !data.to && !data.action) {
    // get count from account entity
    const accountEntity = await getRepository(AccountEntity).findOne({
      address: data.account
    })

    if (accountEntity) {
      return accountEntity.txcount
    }
  }

  let distinctQuery = `SELECT DISTINCT(hash) FROM account_tx WHERE account=$1`
  const params = [data.account]

  if (data.from) {
    distinctQuery += ` AND timestamp >= '${getQueryDateTime(data.from)}'`
  }

  if (data.to) {
    distinctQuery += ` AND timestamp <= '${getQueryDateTime(data.to)}'`
  }

  if (data.action) {
    distinctQuery = `${distinctQuery} AND type=$2`
    params.push(data.action)
  }

  const totalCntQuery = `SELECT COUNT(*) FROM (${distinctQuery}) t`
  const totalCntResult = await getConnection().query(totalCntQuery, params)
  return +get(totalCntResult, '0.count', 0)
}

export async function getTxFromAccount(data: GetTxListParam, parse: boolean): Promise<GetTxsReturn> {
  if (!data.account) {
    throw new TypeError(`Account address is required.`)
  }

  if (!parseInt(data.limit as any, 10)) {
    throw new TypeError('Invalid parameter: limit')
  }

  if (!parseInt(data.page as any, 10)) {
    throw new TypeError('Invalid parameter: page')
  }

  const totalCnt = await getTxTotalCount(data)

  let distinctTxQuery = `SELECT DISTINCT ON (tx_id) tx_id, timestamp FROM account_tx WHERE account=$1 `
  const params = [data.account]

  if (data.action) {
    distinctTxQuery += ` AND type=$2`
    params.push(data.action)
  }

  if (data.from) {
    distinctTxQuery += ` AND timestamp >= '${getQueryDateTime(data.from)}'`
  }

  if (data.to) {
    distinctTxQuery += ` AND timestamp <= '${getQueryDateTime(data.to)}'`
  }

  const offset = Math.max(0, data.limit * (data.page - 1))
  const order: 'ASC' | 'DESC' = data.order && data.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
  const orderAndPageClause = ` ORDER BY tx_id ${order} OFFSET ${offset} LIMIT ${Math.max(0, data.limit)}`

  const subQuery = `SELECT tx_id FROM (${distinctTxQuery}${orderAndPageClause}) a `

  const query = `SELECT data, chain_id FROM tx WHERE id IN (${subQuery}) ORDER BY timestamp ${order}`

  console.log(query, params)
  const txs = await getConnection().query(query, params)

  return {
    totalCnt,
    page: data.page,
    limit: data.limit,
    txs: parse
      ? await Promise.all(txs.map((tx) => parseTx(data.account)(tx)))
      : txs.map((tx) => ({ ...tx.data, chainId: tx.chain_id }))
  }
}

async function getTxs(data: GetTxListParam): Promise<GetTxsReturn> {
  const offset = data.limit * (data.page - 1)
  const order = data.order && data.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  const qb = getRepository(TxEntity)
    .createQueryBuilder()
    .where('chain_id = :chainId', { chainId: config.CHAIN_ID })
    .skip(offset)
    .take(data.limit)
    .orderBy('timestamp', order)

  if (data.from) {
    qb.andWhere('timestamp >= :from', { from: getQueryDateTime(data.from) })
  }

  if (data.to) {
    qb.andWhere('timestamp <= :to', { to: getQueryDateTime(data.to) })
  }
  const [txs, total] = await qb.getManyAndCount()
  return {
    totalCnt: total,
    page: data.page,
    limit: data.limit,
    txs: txs.map((tx) => tx.data as Transaction.LcdTransaction)
  }
}

interface GetTxListReturn {
  totalCnt: number
  page: number
  limit: number
  txs: Transaction.LcdTransaction[]
}

interface GetMsgListReturn {
  totalCnt: number
  page: number
  limit: number
  txs: ParsedTxInfo[]
}

export async function getTxList(param: GetTxListParam): Promise<GetTxListReturn> {
  let txList
  if (param.account) {
    txList = await getTxFromAccount(param, false)
  } else if (param.block) {
    txList = await getTxFromBlock(param)
  } else if (param.memo) {
    txList = await getTxFromMemo(param)
  } else {
    txList = await getTxs(param)
  }
  return {
    totalCnt: txList.totalCnt,
    page: txList.page,
    limit: txList.limit,
    txs: txList.txs
  }
}

export async function getMsgList(param: GetTxListParam): Promise<GetMsgListReturn> {
  const parsedTxs = await getTxFromAccount(param, true)
  return {
    totalCnt: parsedTxs.totalCnt,
    page: parsedTxs.page,
    limit: parsedTxs.limit,
    txs: parsedTxs.txs as ParsedTxInfo[]
  }
}
