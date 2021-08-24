import { unmarshalTx } from '@terra-money/amino-js'
import * as rpc from 'lib/rpc'
import * as lcd from 'lib/lcd'
import { convertPublicKeyToAddress } from 'lib/common'
import { apiLogger as logger } from 'lib/logger'

interface MempoolItem {
  firstSeenAt: number // timestamp (millisecond)
  txhash: string
  lcdTx: Transaction.LcdTx
  addresses: string[] // account address of signatures
}

// Mempool
// updatetores mempool data with map of address to txs and map of hash to tx
class Mempool {
  static hashMap: Map<string, MempoolItem> = new Map()
  static items: MempoolItem[] = []

  static async updateMempool() {
    // Fetches current pending transactions from /unconfirmed_txs from RPC node
    const txStrs = await rpc.getUnconfirmedTxs({ limit: '1000000000000' }, false)
    const timestamp = Date.now()

    logger.info(`mempool: ${txStrs.length} txs found`)

    const newItems = txStrs.map((txStr) => {
      // Convert txStr to txhash and find it from items
      const txhash = lcd.getTxHash(txStr)
      const existingItem = this.hashMap.get(txhash)

      if (existingItem) {
        return existingItem
      }

      // Unmarshal(decode) amino encoded text to json string
      const lcdTx = unmarshalTx(Buffer.from(txStr, 'base64')) as Transaction.LcdTx

      // Decode address from signatures
      const addresses = lcdTx.value.signatures.map((sig) => convertPublicKeyToAddress(sig.pub_key.value))

      const item: MempoolItem = {
        firstSeenAt: timestamp,
        txhash,
        lcdTx,
        addresses
      }

      logger.info(`mempool: ${txhash} ${item.addresses}`)

      this.hashMap.set(txhash, item)
      return item
    })

    // Remove committed transactions from hashMap
    this.hashMap.forEach((item) => {
      if (newItems.findIndex((i) => i.txhash === item.txhash) === -1) {
        this.hashMap.delete(item.txhash)
      }
    })

    // Replace items
    this.items = newItems
    // console.log(`${new Date().toISOString()}: ${newItems.length} txs in mempool`)
  }

  static getTransactionsByAddress(address: string): Transaction.LcdTx[] {
    const lcdTxs: Transaction.LcdTx[] = []

    this.hashMap.forEach((item) => {
      if (item.addresses.indexOf(address) !== -1) {
        lcdTxs.push(item.lcdTx)
      }
    })

    return lcdTxs
  }

  static getTransactionByHash(txhash: string) {
    return this.hashMap.get(txhash.toUpperCase())
  }
}

export default Mempool
