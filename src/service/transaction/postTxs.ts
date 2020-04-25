import { delay } from 'bluebird'
import * as lcd from 'lib/lcd'
import { APIError, ErrorTypes } from 'lib/error'
import { POST_TX_CHECK_LIMIT } from 'lib/constant'

async function checkTx(txhash: string): Promise<Transaction.LcdTransaction> {
  let counter = 1

  while (counter <= POST_TX_CHECK_LIMIT) {
    const res = await lcd.getTx(txhash).catch(() => {
      counter = counter + 1
    })

    if (res) {
      return res
    }

    await delay(1000)
  }

  throw new APIError(ErrorTypes.TIMEOUT)
}

export async function postTxs(tx: Transaction.Value): Promise<Transaction.LcdTransaction> {
  const { txhash } = await lcd
    .broadcast({
      tx,
      mode: 'sync'
    })
    .then((res) => {
      if (res.code) {
        if (!res.raw_log) {
          throw new APIError(ErrorTypes.INVALID_REQUEST_ERROR)
        }

        const errorLog = JSON.parse(res.raw_log)
        throw new APIError(ErrorTypes.INVALID_REQUEST_ERROR, undefined, errorLog.message)
      }

      return res
    })

  return checkTx(txhash)
}
