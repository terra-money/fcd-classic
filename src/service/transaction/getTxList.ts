import { chain } from 'lodash'
import { getRepository, getConnection, FindConditions } from 'typeorm'
import { BlockEntity, TxEntity } from 'orm'
import config from 'config'
import parseTx from './parseTx'

export interface GetTxListParam {
  offset?: number
  account?: string
  block?: string
  action?: string
  limit: number
  order?: string
  chainId?: string
}
interface GetTxsReturn {
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
  const offset = param.offset

  return {
    limit: param.limit,
    txs: chain(txs).drop(offset).take(param.limit).value()
  }
}

export async function getTxFromAccount(param: GetTxListParam, parse: boolean): Promise<GetTxsReturn> {
  if (!param.account) {
    throw new TypeError(`Account address is required.`)
  }

  if (!parseInt(param.limit as any, 10)) {
    throw new TypeError('Invalid parameter: limit')
  }

  let distinctTxQuery = `SELECT DISTINCT ON (tx_id) tx_id FROM account_tx WHERE account=$1 `
  const params = [param.account]

  if (param.action) {
    distinctTxQuery += ` AND type=$2`
    params.push(param.action)
  }

  const order: 'ASC' | 'DESC' = param.order && param.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  if (param.offset) {
    distinctTxQuery += ` AND tx_id ${order === 'ASC' ? '>' : '<'} ${param.offset}`
  }

  const orderAndPageClause = ` ORDER BY tx_id ${order} LIMIT ${Math.max(0, param.limit)}`

  const query = `SELECT id, data, chain_id AS "chainId" FROM tx WHERE id IN (${distinctTxQuery}${orderAndPageClause}) ORDER BY timestamp ${order}`
  const txs = await getConnection().query(query, params)

  return {
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
  }

  const txs = await qb.getMany()

  return {
    limit: param.limit,
    txs: txs.map((tx) => ({ id: tx.id, ...tx.data }))
  }
}

interface GetTxListReturn {
  limit: number
  txs: Transaction.LcdTransaction[]
}

interface GetMsgListReturn {
  limit: number
  txs: ParsedTxInfo[]
}

export async function getTxList(param: GetTxListParam): Promise<GetTxListReturn> {
  let txs

  if (param.account) {
    txs = await getTxFromAccount(param, false)
  } else if (param.block) {
    txs = await getTxFromBlock(param)
  } else {
    txs = await getTxs(param)
  }

  return {
    limit: txs.limit,
    txs: txs.txs
  }
}

export async function getMsgList(param: GetTxListParam): Promise<GetMsgListReturn> {
  const parsedTxs = await getTxFromAccount(param, true)

  return {
    limit: parsedTxs.limit,
    txs: parsedTxs.txs as ParsedTxInfo[]
  }
}
