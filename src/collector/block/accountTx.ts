import { get, mergeWith, union } from 'lodash'
import { TxEntity, AccountTxEntity } from 'orm'

import getAddressFromMsg from '../getAddressFromMsg'

export function getAccountTxDocs(tx: TxEntity): AccountTxEntity[] {
  const msgs = get(tx, 'data.tx.value.msg')
  const concatArray = (objValue, srcValue) => union(objValue, srcValue)
  const addrObj = msgs.map(getAddressFromMsg).reduce((acc, item) => mergeWith(acc, item, concatArray), {})

  return Object.keys(addrObj)
    .map((type) => {
      return addrObj[type].map((addr) => {
        const accountTx = new AccountTxEntity()
        accountTx.account = addr
        accountTx.hash = tx.hash
        accountTx.tx = tx
        accountTx.type = type
        accountTx.timestamp = new Date(tx.data['timestamp'])
        accountTx.chainId = tx.chainId
        return accountTx
      })
    })
    .flat()
}
