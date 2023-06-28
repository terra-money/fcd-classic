import { TxEntity, AccountTxEntity } from 'orm'
import { uniq } from 'lodash'
import { TERRA_ACCOUNT_REGEX } from 'lib/constant'

function extractAddressFromMsg(msg: Transaction.Message): string[] {
  const addrs: string[] = []

  if (!msg) {
    return addrs
  }

  const extractAddressesFromValue = (v) => {
    // v can be null and typeof null is object
    if (!v) {
      return
    }

    if (typeof v === 'string' && TERRA_ACCOUNT_REGEX.test(v)) {
      addrs.push(v)
    } else if (Array.isArray(v)) {
      v.forEach(extractAddressesFromValue)
    } else if (typeof v === 'object') {
      Object.keys(v).forEach((k) => extractAddressesFromValue(v[k]))
    }
  }

  extractAddressesFromValue(msg)
  return addrs
}

function extractAddressFromLog(log: Transaction.Log) {
  if (!log.events) {
    return []
  }

  return log.events
    .map((event) => event.attributes.filter((attr) => TERRA_ACCOUNT_REGEX.test(attr.value)).map((attr) => attr.value))
    .flat()
}

/**
 * This function parses TxEntity for generating AccountTxEntity[]
 * @param tx TxEntity
 */
export function generateAccountTxs(tx: TxEntity): AccountTxEntity[] {
  const msgs = tx.data.tx.value.msg
  const logs = tx.data.logs
  const addrs = msgs.map(extractAddressFromMsg).flat()

  if (logs) {
    addrs.push(...logs.map(extractAddressFromLog).flat())
  }

  return uniq(addrs.filter(Boolean)).map((addr) => {
    const accountTx = new AccountTxEntity()
    accountTx.account = addr
    accountTx.tx = tx
    accountTx.timestamp = tx.timestamp
    return accountTx
  })
}
