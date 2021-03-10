import { get, chain } from 'lodash'
import { getRepository, getConnection, FindConditions } from 'typeorm'
import { BlockEntity, AccountEntity, TxEntity } from 'orm'
import { getQueryDateTime } from 'lib/time'
import config from 'config'
import parseTx from './parseTx'

export interface GetTxListParam {
  offset?: number
  account?: string
  block?: string
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
  txs: ParsedTxInfo[] | ({ id: number } & Transaction.LcdTransaction)[]
}

export async function getTxFromBlock(param: GetTxListParam): Promise<GetTxsReturn> {
  const where: FindConditions<BlockEntity> = {}

  if (param.block) {
    where.height = +param.block
  }

  where.chainId = param.chainId || config.CHAIN_ID

  const blockWithTxs = await getRepository(BlockEntity).findOne({
    where,
    order: {
      id: 'DESC'
    },
    relations: ['txs']
  })

  const txs = blockWithTxs ? blockWithTxs.txs.map((item) => ({ id: item.id, ...item.data })) : []
  const offset = param.limit * (param.page - 1)

  return {
    totalCnt: txs.length,
    page: param.page,
    limit: param.limit,
    txs: chain(txs).drop(offset).take(param.limit).value()
  }
}

async function getTxTotalCount(param: GetTxListParam): Promise<number> {
  if (!param.from && !param.to && !param.action) {
    // get count from account entity
    const accountEntity = await getRepository(AccountEntity).findOne({
      address: param.account
    })

    if (accountEntity) {
      return accountEntity.txcount
    }
  }

  let distinctQuery = `SELECT DISTINCT(hash) FROM account_tx WHERE account=$1`
  const params = [param.account]

  if (param.from) {
    distinctQuery += ` AND timestamp >= '${getQueryDateTime(param.from)}'`
  }

  if (param.to) {
    distinctQuery += ` AND timestamp <= '${getQueryDateTime(param.to)}'`
  }

  if (param.action) {
    distinctQuery = `${distinctQuery} AND type=$2`
    params.push(param.action)
  }

  const totalCntQuery = `SELECT COUNT(*) FROM (${distinctQuery}) t`
  const totalCntResult = await getConnection().query(totalCntQuery, params)
  return +get(totalCntResult, '0.count', 0)
}

export async function getTxFromAccount(param: GetTxListParam, parse: boolean): Promise<GetTxsReturn> {
  if (!param.account) {
    throw new TypeError(`Account address is required.`)
  }

  if (!parseInt(param.limit as any, 10)) {
    throw new TypeError('Invalid parameter: limit')
  }

  if (!parseInt(param.page as any, 10)) {
    throw new TypeError('Invalid parameter: page')
  }

  const totalCnt = await getTxTotalCount(param)

  let distinctTxQuery = `SELECT DISTINCT ON (tx_id) tx_id FROM account_tx WHERE account=$1 `
  const params = [param.account]

  if (param.action) {
    distinctTxQuery += ` AND type=$2`
    params.push(param.action)
  }

  if (param.from) {
    distinctTxQuery += ` AND timestamp >= '${getQueryDateTime(param.from)}'`
  }

  if (param.to) {
    distinctTxQuery += ` AND timestamp <= '${getQueryDateTime(param.to)}'`
  }

  const offset = Math.max(0, param.limit * (param.page - 1))
  const order: 'ASC' | 'DESC' = param.order && param.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  if (param.offset) {
    distinctTxQuery += ` AND tx_id ${order === 'ASC' ? '>' : '<'} ${param.offset}`
  }

  const orderAndPageClause = ` ORDER BY tx_id ${order} ${!param.offset ? `OFFSET ${offset}` : ''} LIMIT ${Math.max(
    0,
    param.limit
  )}`

  const query = `SELECT id, data, chain_id AS "chainId" FROM tx WHERE id IN (${distinctTxQuery}${orderAndPageClause}) ORDER BY timestamp ${order}`
  const txs = await getConnection().query(query, params)

  return {
    totalCnt,
    page: param.page,
    limit: param.limit,
    txs: parse
      ? await Promise.all(txs.map((tx) => parseTx(tx, param.account)))
      : txs.map((tx) => ({ id: tx.id, chainId: tx.chainId, ...tx.data }))
  }
}

async function getTxs(param: GetTxListParam): Promise<GetTxsReturn> {
  const order = param.order && param.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
  const qb = getRepository(TxEntity).createQueryBuilder().take(param.limit).orderBy('timestamp', order)

  if (param.offset) {
    qb.andWhere(`id ${order === 'ASC' ? '>' : '<'} :offset`, { offset: param.offset })
  } else {
    qb.skip(param.limit * (param.page - 1))
  }

  if (param.from) {
    qb.andWhere('timestamp >= :from', { from: getQueryDateTime(param.from) })
  }

  if (param.to) {
    qb.andWhere('timestamp <= :to', { to: getQueryDateTime(param.to) })
  }

  const txs = await qb.getMany()

  return {
    totalCnt: -1,
    page: param.page,
    limit: param.limit,
    txs: txs.map((tx) => ({ id: tx.id, ...tx.data }))
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
