import * as moment from 'moment'
import { createObjectCsvStringifier } from 'csv-writer'
import { makeQuery } from 'lib/athena'
import { uploadFile } from 'lib/s3'
import { isSuccessfulTx } from 'lib/tx'
import { sliceMsgType, getAmountAndDenom, getMsgValue } from 'lib/utility'
import format from 'lib/format'

export interface TxCSVParams {
  account: string
  chainId: string
  from: number
  to: number
  order: string
}

export interface TxCSVResponse {
  link: string
}

export interface TxItem {
  hash: string
  status: string
  errorMessage: string
  network: string
  block: number
  timestamp: string
  fee: string
  tax: string
  gas: string
  memo: string
  message: string
}

interface AthenaTxItem {
  id: number
  hash: string
  height: number
  address: string
  timestamp: string
  data: string
}

interface MsgItem {
  type: string
  value: any
  events: object[]
}

export const TX_TABLE = `transactions`
export const CSV_MAX_ROWS = 20000

export async function generateCsv(txs: TxItem[]): Promise<string> {
  const csvStringifier = createObjectCsvStringifier({
    header: ['hash', 'status', 'errorMessage', 'network', 'block', 'timestamp', 'fee', 'tax', 'gas', 'memo', 'message']
  })

  const csv = csvStringifier.stringifyRecords(txs)

  const url = await uploadFile(csv)

  return url
}

export async function getTxCsvFile(param: TxCSVParams): Promise<TxCSVResponse> {
  const { account, chainId, from, to, order } = param
  const startDateUTC = moment.utc(from).format('YYYY-MM-DD h:mm:ss')
  const endDateUTC = moment.utc(to).format('YYYY-MM-DD h:mm:ss')
  const query = `
    SELECT DISTINCT id, hash, height, address, timestamp, data
    FROM ${TX_TABLE}
    WHERE address = '${account}'
      AND chain_id = '${chainId}'
      AND timestamp BETWEEN TIMESTAMP '${startDateUTC}' AND TIMESTAMP '${endDateUTC}'
    ORDER BY timestamp ${order}
    LIMIT ${CSV_MAX_ROWS}
  `

  const rows: AthenaTxItem[] = await makeQuery<AthenaTxItem>(query)
  const transactions: TxItem[] = rows.map((row) => {
    let fee = '0 Luna'
    let tax = '0 Luna'
    const messages: MsgItem[] = []
    const lcdTx = JSON.parse(row.data) as Transaction.LcdTransaction
    const success = isSuccessfulTx(lcdTx)
    const status = success ? 'success' : 'failed'
    const errorMessage = !success ? lcdTx.raw_log || '' : ''
    const firstMsgType = lcdTx.tx.value.msg[0].type ?? ''

    if (['MsgMultiSend', 'MsgSend'].includes(sliceMsgType(firstMsgType))) {
      const taxes: Coin[] = []

      lcdTx.logs.forEach((item) => {
        if (typeof item.log === 'object') {
          item.log.tax.split(',').forEach((value) => {
            const { amount, denom } = getAmountAndDenom(value)

            if (denom && amount) {
              taxes.push({ amount, denom })
            }
          })
        }
      })

      tax = taxes.map(({ denom, amount }) => `${format.coin({ amount, denom })}`).join(', ')
    }

    if (lcdTx.tx.value.fee.amount.length > 0) {
      fee = lcdTx.tx.value.fee.amount.map(({ denom, amount }) => `${format.coin({ amount, denom })}`).join(', ')
    }

    lcdTx.tx.value.msg.forEach((msg, i) => {
      const log = lcdTx.logs?.[i] || {}
      const item: MsgItem = {
        type: sliceMsgType(msg.type),
        value: Object.keys(msg.value).map((key) => getMsgValue(msg, key)),
        events: []
      }

      if (log?.events) {
        item.events = log.events.map((value, key) => ({
          type: `[${key}] ${value.type}`,
          attributes: value.attributes.map((attr) => ({
            key: attr.key,
            value: attr.value
          }))
        }))
      }

      messages.push(item)
    })

    const item: TxItem = {
      hash: row.hash,
      status,
      errorMessage,
      network: chainId,
      block: row.height,
      timestamp: row.timestamp,
      fee,
      tax,
      gas: `${parseInt(lcdTx.gas_used).toLocaleString()}/${parseInt(lcdTx.gas_wanted).toLocaleString()}`,
      memo: lcdTx.tx.value.memo ?? '-',
      message: JSON.stringify(messages)
    }

    return item
  })

  const link = await generateCsv(transactions)

  return { link }
}
