import * as Bluebird from 'bluebird'
import { get } from 'lodash'

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

export default function parseTx(account: string | undefined) {
  return async (tx: TxEntity): Promise<ParsedTxInfo> => {
    const lcdTx = get(tx, 'data') as Transaction.LcdTransaction
    const msgs = get(lcdTx, 'tx.value.msg') as Transaction.Message[]
    const logs: Transaction.Log[] = lcdTx.logs ? lcdTx.logs : failedRawLogToLogs(get(tx, 'data.raw_log'))
    const chainId = get(tx, 'chain_id')

    const success = isSuccessfulTx(lcdTx)
    const errorMessage = lcdTx.raw_log ? lcdTx.raw_log : ''

    const parsedMsgs: ParsedTxMsgInfo[] = await Bluebird.map(msgs, (msg, i) => parseMsg(msg, logs[i], account, success))

    return {
      timestamp: get(lcdTx, 'timestamp'),
      txhash: get(lcdTx, 'txhash'),
      msgs: parsedMsgs,
      txFee: get(lcdTx, 'tx.value.fee.amount'),
      memo: get(lcdTx, 'tx.value.memo'),
      success,
      errorMessage,
      chainId
    }
  }
}
