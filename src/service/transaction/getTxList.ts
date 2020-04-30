import { get, chain } from 'lodash'
import { BlockEntity, AccountEntity } from 'orm'
import { getRepository, getConnection } from 'typeorm'
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

export async function getTxFromMemo(data: GetTxListParam): Promise<GetTxsReturn> {
  if (!data.memo) {
    throw new Error(`memo is required.`)
  }

  const order = data.order && data.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  const query = `select data from tx where data->'tx'->'value'->>'memo'='${data.memo}' \
order by data->'timestamp' ${order}`

  const txs = await getConnection().query(query)
  return {
    totalCnt: txs.length,
    page: data.page,
    limit: data.limit,
    txs: txs.map((tx) => tx.data)
  }
}

export async function getTxFromBlock(data: GetTxListParam): Promise<GetTxsReturn> {
  const where = { height: data.block }

  if (data.chainId) {
    where['chainId'] = data.chainId
  }

  const blocksWithTxs = await getRepository(BlockEntity).find({
    where,
    order: {
      id: 'DESC'
    },
    relations: ['txs']
  })
  const blockWithTxs = blocksWithTxs.length > 0 ? blocksWithTxs[0] : undefined

  const txs: Transaction.LcdTransaction[] = blockWithTxs
    ? blockWithTxs.txs.map((item) => item.data as Transaction.LcdTransaction)
    : []
  const offset = data.limit * (data.page - 1)

  return {
    totalCnt: txs.length,
    page: data.page,
    limit: data.limit,
    txs: chain(txs).drop(offset).take(data.limit).value()
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

  let distinctQuery = `select distinct(hash) from account_tx where account='${data.account}'`

  if (data.from) {
    distinctQuery += ` and timestamp >= '${getQueryDateTime(data.from)}'`
  }

  if (data.to) {
    distinctQuery += ` and timestamp <= '${getQueryDateTime(data.to)}'`
  }

  if (data.action) {
    distinctQuery = `${distinctQuery} and type='${data.action}'`
  }

  const totalCntQuery = `with distinctHashes as (${distinctQuery}) select count(*) from distinctHashes`
  const totalCntResult = await getConnection().query(totalCntQuery)
  return +get(totalCntResult, '0.count', 0)
}

export async function getTxFromAccount(data: GetTxListParam, parse: boolean): Promise<GetTxsReturn> {
  if (!data.account) {
    throw new Error(`Account address is required.`)
  }

  const totalCnt = await getTxTotalCount(data)

  const offset = data.limit * (data.page - 1)
  const order = data.order && data.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  let distinctTxQuery = `select distinct on (tx_id) tx_id, timestamp from account_tx\
  where account='${data.account}' `

  const orderAndPageClause = ` order by tx_id ${order} offset ${offset} limit ${data.limit}`

  if (data.action) {
    distinctTxQuery += ` and type='${data.action}'`
  }

  if (data.from) {
    distinctTxQuery += ` and timestamp >= '${getQueryDateTime(data.from)}'`
  }

  if (data.to) {
    distinctTxQuery += ` and timestamp <= '${getQueryDateTime(data.to)}'`
  }

  const subQuery = `select tx_id from (${distinctTxQuery}${orderAndPageClause}) a `

  const query = `select data, chain_id from tx where id in (${subQuery}) order by data->'timestamp' ${order}`

  const txsReq = getConnection().query(query)

  const txs = await txsReq

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
  const orderAndPageClause = ` order by timestamp ${order} offset ${offset} limit ${data.limit}`

  const query = `select data from tx where chain_id='${config.CHAIN_ID}' ${orderAndPageClause}`
  const txs = await getConnection().query(query)

  return {
    totalCnt: txs.length,
    page: data.page,
    limit: data.limit,
    txs: txs.map((tx) => tx.data)
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
