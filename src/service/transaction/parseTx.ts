import * as Bluebird from 'bluebird'
import { isSuccessfulTx } from 'lib/tx'
import parseMsg from './parseMsg'

function failedRawLogToLogs(
  rawLog: string
): {
  success: boolean
  log: string
  msg_index: number
}[] {
  let parsed

  try {
    parsed = JSON.parse(rawLog)
  } catch (e) {
    // its not a json parsable, so using the raw log directly
    parsed = rawLog
  }

  return [
    {
      log: parsed,
      success: false,
      msg_index: 0
    }
  ]
}

export default async function parseTx(
  tx: { id: number } & Transaction.LcdTransaction,
  account?: string
): Promise<ParsedTxInfo> {
  const success = isSuccessfulTx(tx)
  const errorMessage = !success ? tx.raw_log || '' : undefined

  const logs: Transaction.Log[] = tx.logs ? tx.logs : failedRawLogToLogs(tx.raw_log)
  const parsedMsgs: ParsedTxMsgInfo[] = await Bluebird.map(tx.tx.value.msg, (msg, i) =>
    parseMsg(msg, logs[i], account, success)
  )

  return {
    id: tx.id,
    timestamp: tx.timestamp,
    txhash: tx.txhash,
    msgs: parsedMsgs,
    txFee: tx.tx.value.fee.amount,
    memo: tx.tx.value.memo,
    success,
    errorMessage
  }
}
