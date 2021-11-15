import { getRepository, getManager } from 'typeorm'
import { BlockEntity, TxEntity } from 'orm'

export interface GetTxListParam {
  offset?: number
  account?: string
  block?: string
  limit: number
  order?: string
  chainId?: string
  compact?: boolean
}

interface GetTxsResponse {
  next?: number
  limit: number
  txs: ({ id: number } & Transaction.LcdTransaction)[]
}

export async function getTxFromBlock(param: GetTxListParam): Promise<GetTxsResponse> {
  const order: 'ASC' | 'DESC' = param.order && param.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
  const qb = await getRepository(BlockEntity).createQueryBuilder('block').where('block.height = :height', {
    height: param.block
  })

  if (param.offset) {
    qb.leftJoinAndSelect('block.txs', 'txs', 'txs.id < :offset', { offset: param.offset })
  } else {
    qb.leftJoinAndSelect('block.txs', 'txs')
  }

  qb.orderBy('block.timestamp', order)
  qb.addOrderBy('txs.id', order).take(param.limit + 1)

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

function hasValueInObject(obj: any, value: string): boolean {
  if (typeof obj === 'string' && value === obj) {
    return true
  } else if (Array.isArray(obj)) {
    if (obj.some((o2) => hasValueInObject(o2, value))) {
      return true
    }
  } else if (typeof obj === 'object' && obj !== null) {
    if (Object.keys(obj).some((key) => hasValueInObject(obj[key], value))) {
      return true
    }
  }

  return false
}

function hasValueInLog(log: Transaction.Log, value: string) {
  if (!log.events) {
    return false
  }

  return log.events.some((event) => event.attributes.some((attr) => value === attr.value))
}

/**
 * This function is for reducing size of response data by stripping out irrelevant msgs & logs by specific address
 */
function compactTransactionData(data: Transaction.LcdTransaction, address: string) {
  const newData = {
    ...data
  }
  const msgIndexes: number[] = []

  // Look for address in each messages
  if (data.tx.value.msg) {
    data.tx.value.msg.forEach((m, index) => {
      if (hasValueInObject(m, address)) {
        msgIndexes.push(index)
      }
    })
  }

  // Look for address in each logs
  if (data.logs) {
    data.logs.forEach((l) => {
      if (hasValueInLog(l, address)) {
        msgIndexes.push(l.msg_index)
      }
    })
  }

  // Strip out irrelevant msgs & logs
  if (msgIndexes.length) {
    newData.tx.value.msg = data.tx.value.msg.filter((_, index) => msgIndexes.indexOf(index) !== -1)
    newData.logs = data.logs.filter((l) => msgIndexes.indexOf(l.msg_index) !== -1)
  }

  // Strip out raw_log if the tx has not been failed
  if (!data.code) {
    newData.raw_log = ''
  }

  return newData
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
      txs: txs.map((tx) => ({
        id: tx.id,
        chainId: tx.chainId,
        ...(param.compact ? compactTransactionData(tx.data, param.account as string) : tx.data)
      }))
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
