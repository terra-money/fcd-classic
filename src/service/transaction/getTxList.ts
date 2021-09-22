import { getRepository, getManager } from 'typeorm'
import { BlockEntity, TxEntity } from 'orm'
import config from 'config'
import parseTx from './parseTx'

export interface GetTxListParam {
  offset?: number
  account?: string
  block?: string
  limit: number
  order?: string
  chainId?: string
}

interface GetTxsResponse {
  next?: number
  limit: number
  txs: ({ id: number } & Transaction.LcdTransaction)[]
}

export async function getTxFromBlock(param: GetTxListParam): Promise<GetTxsResponse> {
  const order: 'ASC' | 'DESC' = param.order && param.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
  const qb = await getRepository(BlockEntity)
    .createQueryBuilder('block')
    .where('block.height = :height AND block.chainId = :chainId', {
      height: param.block,
      chainId: param.chainId || config.CHAIN_ID
    })

  if (param.offset) {
    qb.leftJoinAndSelect('block.txs', 'txs', 'txs.id < :offset', { offset: param.offset })
  } else {
    qb.leftJoinAndSelect('block.txs', 'txs')
  }

  qb.orderBy('txs.id', order).take(param.limit + 1)

  const blockWithTxs = await qb.getOne()
  const txs = blockWithTxs ? blockWithTxs.txs.map((item) => ({ id: item.id, ...item.data })) : []

  let next

  // we have next result
  if (param.limit + 1 === txs.length) {
    next = txs[param.limit - 1].id
    txs.length -= 1
  }

  return {
    next,
    limit: param.limit,
    txs
  }
}

export async function getTxFromAccount(param: GetTxListParam): Promise<GetTxsResponse> {
  if (!param.account) {
    throw new TypeError(`Account address is required.`)
  }

  if (!parseInt(param.limit as any, 10)) {
    throw new TypeError('Invalid parameter: limit')
  }

  let subQuery = `SELECT tx_id FROM account_tx WHERE account=$1 `
  const params = [param.account]

  const order: 'ASC' | 'DESC' = param.order && param.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  if (param.offset) {
    subQuery += ` AND tx_id ${order === 'ASC' ? '>' : '<'} ${param.offset}`
  }

  const orderAndPageClause = ` ORDER BY tx_id ${order} LIMIT ${Math.max(0, param.limit + 1)}`

  return getManager().transaction(async (mgr) => {
    // Disable indexscan to force use bitmap scan for query speed
    await mgr.query('SET enable_indexscan=false')

    const query = `SELECT id, data, chain_id AS "chainId" FROM tx WHERE id IN (${subQuery}${orderAndPageClause}) ORDER BY id DESC`
    const txs = await mgr.query(query, params)

    await mgr.query('SET enable_indexscan=true')

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
  })
}

async function getTxs(param: GetTxListParam): Promise<GetTxsResponse> {
  const order = param.order && param.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
  const qb = getRepository(TxEntity)
    .createQueryBuilder()
    .take(param.limit + 1)
    .orderBy('id', order)

  if (param.chainId) {
    qb.where({
      chainId: param.chainId
    })
  }

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

interface GetTxListResponse {
  next?: number
  limit: number
  txs: Transaction.LcdTransaction[]
}

interface GetMsgListReturn {
  next?: number
  limit: number
  txs: ParsedTxInfo[]
}

export async function getTxList(param: GetTxListParam): Promise<GetTxListResponse> {
  let response

  if (param.account) {
    response = await getTxFromAccount(param)
  } else if (param.block) {
    response = await getTxFromBlock(param)
  } else {
    response = await getTxs(param)
  }

  return response
}

export async function getMsgList(param: GetTxListParam): Promise<GetMsgListReturn> {
  const { next, limit, txs } = await getTxFromAccount(param)

  return {
    next,
    limit,
    txs: await Promise.all(txs.map((tx) => parseTx(tx, param.account)))
  }
}
