import * as Bluebird from 'bluebird'
import { get, filter } from 'lodash'
import parseMsg from './parseMsg'

function isSuccessful(logs): { success: boolean; errorMessage?: string } {
  const failed = filter(logs, { success: false })
  return !logs || failed.length > 0
    ? { success: false, errorMessage: get(failed[0], 'log.message') }
    : { success: true }
}

function failedRawLogToLogs(
  rawLog: string
): {
  success: boolean
  log: string
  msg_index: string
}[] {
  let parsed

  try {
    parsed = JSON.parse(rawLog)
  } catch (e) {
    // do nothing
  }

  return (
    parsed && [
      {
        log: parsed,
        success: false,
        msg_index: '0'
      }
    ]
  )
}

export default function parseMsgsInTx(account: string | undefined) {
  return async (tx): Promise<ParsedTxInfo> => {
    const msgs = get(tx, 'data.tx.value.msg') as Transaction.Message[]
    const logs: Transaction.Log[] = tx.data.logs ? get(tx, 'data.logs') : failedRawLogToLogs(get(tx, 'data.raw_log'))
    const chainId = get(tx, 'chain_id')
    const { success, errorMessage } = isSuccessful(logs)

    const tax = get(logs[0], 'log.tax')

    const parsedMsgs: ParsedTxMsgInfo[] = await Bluebird.map(msgs, (msg) => {
      // index 0 is tax info
      const log = logs && logs.slice(1)
      return parseMsg(msg, log, account, success)
    })
    return {
      timestamp: get(tx, 'data.timestamp'),
      txhash: get(tx, 'data.txhash'),
      msgs: parsedMsgs,
      txFee: get(tx, 'data.tx.value.fee.amount'),
      memo: get(tx, 'data.tx.value.memo'),
      tax,
      success,
      errorMessage,
      chainId
    }
  }
}
