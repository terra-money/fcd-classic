import { getConnection } from 'typeorm'
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
  const queryRunner = getConnection().createQueryRunner('slave')

  try {
    const qb = queryRunner.manager.createQueryBuilder(BlockEntity, 'block').where('block.height = :height', {
      height: param.block
    })

    const block = await qb.getOne()

    if (!block) {
      return { limit: param.limit, txs: [] }
    }

    const order: 'ASC' | 'DESC' = param.order && param.order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    const txqb = queryRunner.manager
      .createQueryBuilder(TxEntity, 'tx')
      .where('tx.block_id = :blockId', { blockId: block.id })
      .orderBy('tx.id', order)
      .take(param.limit + 1)

    if (param.offset) {
      txqb.andWhere(`tx.id ${order === 'ASC' ? '>' : '<'} :offset`, { offset: param.offset })
    }

    const txs = (await txqb.getMany()).map((tx) => ({ id: tx.id, ...tx.data }))
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
  } finally {
    queryRunner.release()
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
    subQuery += `AND tx_id ${order === 'ASC' ? '>' : '<'} ${param.offset} `
  }

  subQuery += `ORDER BY tx_id ${order} LIMIT ${Math.max(0, param.limit + 1)}`

  const queryRunner = getConnection().createQueryRunner('slave')

  try {
    // Disable indexscan to force use bitmap scan for query speed
    await queryRunner.query('SET enable_indexscan=false')
    const accountTxs = await queryRunner.query(subQuery, params)
    let next

    if (param.limit + 1 === accountTxs.length) {
      next = accountTxs[param.limit - 1].tx_id
      accountTxs.length -= 1
    }

    const txs = accountTxs.length
      ? await queryRunner.query(
          `SELECT id, data, chain_id AS "chainId" FROM tx WHERE id IN (${accountTxs
            .map((t) => t.tx_id)
            .toString()}) ORDER BY id DESC`
        )
      : []

    return {
      next,
      limit: param.limit,
      txs: txs.map((tx) => ({
        id: tx.id,
        chainId: tx.chainId,
        ...(param.compact ? compactTransactionData(tx.data, param.account as string) : tx.data)
      }))
    }
  } finally {
    await queryRunner.query('SET enable_indexscan=true')
    queryRunner.release()
  }
}

async function getTxs(param: GetTxListParam): Promise<GetTxsResponse> {
  const order = param.order && param.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
  const queryRunner = getConnection().createQueryRunner('slave')

  try {
    const qb = queryRunner.manager
      .createQueryBuilder(TxEntity, 'tx')
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
  } finally {
    queryRunner.release()
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
