import * as Bluebird from 'bluebird'
import * as sentry from '@sentry/node'
import * as rpc from 'lib/rpc'
import { decodeTx, getTxHash } from 'lib/tx'
import { apiLogger as logger } from 'lib/logger'
import RPCWatcher from 'lib/RPCWatcher'
import config from 'config'

const debug = require('debug')('mempool')
const UPDATE_PERIOD = 1000

interface MempoolItem {
  timestamp: string // ISO Date
  txhash: string
  tx: Transaction.LcdTx
  addresses: string[] // account address of signatures
}

export type MempoolItemResponse = Omit<MempoolItem, 'addresses'> & { chainId: string }

const transformItemToResponse = (item: MempoolItem): MempoolItemResponse => ({
  timestamp: new Date(item.timestamp).toISOString(),
  tx: item.tx,
  txhash: item.txhash,
  chainId: config.CHAIN_ID
})

/**
 * Mempool is a singleton that indexes mempool periodically in local cache
 * for providing transaction queries by hash, and account (terra1..)
 */
class Mempool {
  // key = txhash
  static hashMap: Map<string, MempoolItem> = new Map()
  static items: MempoolItem[] = []
  static updatePeriod = UPDATE_PERIOD

  /**
   * This is the entry point for initializing and starting up
   * @param updatePeriod interval time for updating mempool data in local cache
   */
  static start(updatePeriod = UPDATE_PERIOD) {
    this.updatePeriod = updatePeriod

    // Listen to new block event via RPCWatcher (websocket) for removing committed tx from cached mempool
    const watcher = new RPCWatcher({
      url: `${config.RPC_URI.replace('http', 'ws')}/websocket`,
      logger
    })

    watcher.registerSubscriber(`tm.event='NewBlock'`, async (data) => {
      const marshalTxs = data.result.data?.value.block?.data.txs as string[]

      if (marshalTxs) {
        marshalTxs.map((strTx) => {
          const txhash = getTxHash(strTx)
          debug(`mempool: removing ${txhash}`)
          this.hashMap.delete(txhash)
        })
      }
    })

    watcher.start()

    // Trigger updateMempool periodically
    setInterval(() => {
      this.updateMempool().catch((err) => {
        sentry.captureException(err)
      })
    }, this.updatePeriod)
  }

  /**
   * updateMempool queries `unconfirmed_txs` to Terra RPC server and stores it into hashMap and items.
   * To prepare for situations where RPCWatcher doesn't fire NewBlock events (connection lost, etc.),
   * it additionally removes transactions that no longer exist in cached mempool.
   */
  private static async updateMempool() {
    // Fetches current pending transactions from /unconfirmed_txs from RPC node
    const txStrs = await rpc.getUnconfirmedTxs({ limit: '1000000000000' })
    const timestamp = new Date().toISOString()

    debug(`${txStrs.length} txs found`)

    const newItems = await Bluebird.map(txStrs, async (txStr) => {
      // Convert txStr to txhash and find it from items
      const txhash = getTxHash(txStr)
      const existingItem = this.hashMap.get(txhash)

      if (existingItem) {
        return existingItem
      }

      // decode encoded text to json string
      const tx = decodeTx(txStr)

      // Decode address from signatures
      const addresses = tx.auth_info.signer_infos.map((info) => info.public_key.address())

      const item: MempoolItem = {
        timestamp,
        txhash,
        tx: tx.toData() as Transaction.LcdTx,
        addresses
      }

      debug(`${txhash} ${item.addresses}`)

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
  }

  static getTransactionsByAddress(address: string): MempoolItemResponse[] {
    const items: MempoolItemResponse[] = []

    this.hashMap.forEach((i) => {
      if (i.addresses.indexOf(address) !== -1) {
        items.push(transformItemToResponse(i))
      }
    })

    return items
  }

  static getTransactionByHash(txhash: string): MempoolItemResponse | null {
    const item = this.hashMap.get(txhash.toUpperCase())

    if (!item) {
      return null
    }

    return transformItemToResponse(item)
  }

  static getTransactions(): MempoolItemResponse[] {
    return this.items.map(transformItemToResponse)
  }
}

export default Mempool
