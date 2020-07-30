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
    // its not a json parsable, so using the raw log directly
    parsed = rawLog
  }

  return [
    {
      log: parsed,
      success: false,
      msg_index: '0'
    }
  ]
}

export default function parseTx(account: string | undefined) {
  return async (tx): Promise<ParsedTxInfo> => {
    const msgs = get(tx, 'data.tx.value.msg') as Transaction.Message[]
    const logs: Transaction.Log[] = tx.data.logs ? tx.data.logs : failedRawLogToLogs(get(tx, 'data.raw_log'))
    const chainId = get(tx, 'chain_id')
    const { success, errorMessage } = isSuccessful(logs)

    const parsedMsgs: ParsedTxMsgInfo[] = await Bluebird.map(msgs, (msg, i) => parseMsg(msg, logs[i], account, success))

    return {
      timestamp: get(tx, 'data.timestamp'),
      txhash: get(tx, 'data.txhash'),
      msgs: parsedMsgs,
      txFee: get(tx, 'data.tx.value.fee.amount'),
      memo: get(tx, 'data.tx.value.memo'),
      success,
      errorMessage,
      chainId
    }
  }
}
