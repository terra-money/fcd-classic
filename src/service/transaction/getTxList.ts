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
  next?: number
  limit: number
  txs: ({ id: number } & Transaction.LcdTransaction)[]
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

  const txs = blockWithTxs
    ? blockWithTxs.txs.map((item) => ({
        id: item.id,
        ...item.data
      }))
    : []

  return {
    limit: param.limit,
    txs: txs.reduce((prev, curr) => {
      if (prev.length < param.limit && (!param.offset || curr.id < param.offset)) {
        prev.push(curr)
      }

      return prev
    }, [] as ({ id: number } & Transaction.LcdTransaction)[])
  }
}

export async function getTxFromAccount(param: GetTxListParam): Promise<GetTxsReturn> {
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

  const orderAndPageClause = ` ORDER BY tx_id ${order} LIMIT ${Math.max(0, param.limit + 1)}`

  const query = `SELECT id, data, chain_id AS "chainId" FROM tx WHERE id IN (${distinctTxQuery}${orderAndPageClause}) ORDER BY timestamp ${order}`
  const txs = await getConnection().query(query, params)

  let next

  if (param.limit + 1 === txs.length) {
    next = txs[param.limit - 1].id
    txs.length -= 1
  }

  return {
    next,
    limit: param.limit,
    txs: txs.map((tx) => ({ id: tx.id, chainId: tx.chainId, ...tx.data }))
  }
}

async function getTxs(param: GetTxListParam): Promise<GetTxsReturn> {
  const order = param.order && param.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
  const qb = getRepository(TxEntity)
    .createQueryBuilder()
    .take(param.limit + 1)
    .orderBy('timestamp', order)

  if (param.offset) {
    qb.andWhere(`id ${order === 'ASC' ? '>' : '<'} :offset`, { offset: param.offset })
  }

  const txs = await qb.getMany()

  let next

  // we have next result
  if (param.limit + 1 === txs.length) {
    next = txs[param.limit - 1].id
    txs.length -= 1
  }

  return {
    next,
    limit: param.limit,
    txs: txs.map((tx) => ({ id: tx.id, ...tx.data }))
  }
}

interface GetTxListReturn {
  next?: number
  limit: number
  txs: Transaction.LcdTransaction[]
}

interface GetMsgListReturn {
  next?: number
  limit: number
  txs: ParsedTxInfo[]
}

export async function getTxList(param: GetTxListParam): Promise<GetTxListReturn> {
  let txs

  if (param.account) {
    txs = await getTxFromAccount(param)
  } else if (param.block) {
    txs = await getTxFromBlock(param)
  } else {
    txs = await getTxs(param)
  }

  return txs
}

export async function getMsgList(param: GetTxListParam): Promise<GetMsgListReturn> {
  const { next, limit, txs } = await getTxFromAccount(param)

  return {
    next,
    limit,
    txs: await Promise.all(txs.map((tx) => parseTx(tx, param.account)))
  }
}
