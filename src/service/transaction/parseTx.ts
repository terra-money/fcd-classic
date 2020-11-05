import * as Bluebird from 'bluebird'
import { TxEntity } from 'orm'
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
  tx: Pick<TxEntity, 'id' | 'data' | 'chainId'>,
  account?: string
): Promise<ParsedTxInfo> {
  const lcdTx = tx.data
  const success = isSuccessfulTx(lcdTx)
  const errorMessage = !success ? lcdTx.raw_log || '' : undefined

  const logs: Transaction.Log[] = lcdTx.logs ? lcdTx.logs : failedRawLogToLogs(lcdTx.raw_log)
  const parsedMsgs: ParsedTxMsgInfo[] = await Bluebird.map(tx.data.tx.value.msg, (msg, i) =>
    parseMsg(msg, logs[i], account, success)
  )

  return {
    id: tx.id,
    timestamp: lcdTx.timestamp,
    txhash: lcdTx.txhash,
    msgs: parsedMsgs,
    txFee: lcdTx.tx.value.fee.amount,
    memo: lcdTx.tx.value.memo,
    success,
    errorMessage,
    chainId: tx.chainId
  }
}
