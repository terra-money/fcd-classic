import * as Bluebird from 'bluebird'
import { EntityManager, In } from 'typeorm'
import { compact, chunk } from 'lodash'

import { BlockEntity, TxEntity, AccountTxEntity } from 'orm'

import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { generateAccountTxs } from './accountTx'

//Recursively iterating thru the keys of the tx object to find unicode characters that would otherwise mess up db update.
//If unicode is found in the string, then the value is base64 encoded.
//Recursion is not implemented well in js, so in case of deeply nested objects, this might fail with RangeError: Maximum call stack size exceeded
//Tx objects are hopefully not that deep, but just in case they are https://replit.com/@mkotsollaris/javascript-iterate-for-loop?v=1#index.js or something along those lines.
//Going with simple recursion due time constaints.
function sanitizeTx(tx: Transaction.LcdTransaction): Transaction.LcdTransaction {
  function hasUnicode(s) {
    // eslint-disable-next-line no-control-regex
    return /[^\u0000-\u007f]/.test(s)
  }

  const iterateTx = (obj) => {
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        iterateTx(obj[key])
      } else {
        if (hasUnicode(obj[key])) {
          const b = Buffer.from(obj[key])
          obj[key] = b.toString('base64')
        }
      }
    })
  }
  iterateTx(tx)
  return tx
}

export async function generateLcdTransactionToTxEntity(txhash: string, block: BlockEntity): Promise<TxEntity> {
  // Get the tx from LCD server
  const lcdTx = await lcd.getTx(txhash)

  const txEntity = new TxEntity()
  txEntity.chainId = block.chainId
  txEntity.hash = lcdTx.txhash.toLowerCase()
  txEntity.data = sanitizeTx(lcdTx)
  txEntity.timestamp = new Date(lcdTx.timestamp)
  txEntity.block = block
  return txEntity
}

async function generateTxEntities(txHashes: string[], block: BlockEntity): Promise<TxEntity[]> {
  // txs with the same tx hash may appear more than once in the same block duration
  const txHashesUnique = new Set(txHashes)
  return Bluebird.map([...txHashesUnique], (txHash) => generateLcdTransactionToTxEntity(txHash, block))
}

export async function collectTxs(mgr: EntityManager, txHashes: string[], block: BlockEntity): Promise<TxEntity[]> {
  const txEntities = await generateTxEntities(txHashes, block)

  // Skip transactions that have already been successful
  const existingTxs = await mgr.find(TxEntity, { where: { hash: In(txEntities.map((t) => t.hash.toLowerCase())) } })

  existingTxs.forEach((e) => {
    if (!e.data.code) {
      const idx = txEntities.findIndex((t) => t.hash === e.hash)

      if (idx < 0) {
        throw new Error('impossible')
      }

      logger.info(`collectTxs: existing successful tx found: ${e.hash}`)
      txEntities.splice(idx, 1)
    }
  })

  // Save TxEntity
  // NOTE: Do not use printSql, getSql, or getQuery function.
  // It breaks parameter number ordering caused by a bug from TypeORM
  const qb = mgr
    .createQueryBuilder()
    .insert()
    .into(TxEntity)
    .values(txEntities)
    .orUpdate(['timestamp', 'data', 'block_id'], ['chain_id', 'hash'])

  await qb.execute()

  // generate AccountTxEntities
  const accountTxs: AccountTxEntity[] = compact(txEntities)
    .map((txEntity) => generateAccountTxs(txEntity))
    .flat()

  // Save AccountTxEntity to the database
  // chunkify array up to 5,000 elements to avoid SQL parameter overflow
  await Bluebird.mapSeries(chunk(accountTxs, 5000), (chunk) => mgr.save(chunk))

  logger.info(`collectTxs: ${txEntities.length}, accountTxs: ${accountTxs.length}`)
  return txEntities
}
