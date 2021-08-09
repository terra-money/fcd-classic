/**
 * This script was written for migrating columbus-1 Block, Tx, AccountTx entities to main db
 */
import * as fs from 'fs'
import * as Bluebird from 'bluebird'
import { getConnection, EntityManager } from 'typeorm'
import { chunk, find } from 'lodash'
import { init as initORM, BlockEntity, TxEntity, AccountTxEntity } from 'orm'

async function migrate() {
  const src = getConnection('default')
  /*
  const blocks = await src.query(`SELECT id, chain_id, height, timestamp FROM block ORDER BY height`)
  fs.writeFileSync('blocks.json', JSON.stringify(blocks));
  */
  const blocks: {
    id: number
    chain_id: string
    height: number
    timestamp: string
  }[] = JSON.parse(fs.readFileSync('blocks.json', 'utf-8'))
  /*
  {
    id: 2,
    chain_id: 'columbus-1',
    height: 1,
    timezone: 2019-04-24T06:00:00.000Z
  }
  */
  await getConnection('mainnet').manager.transaction(async (mgr: EntityManager) => {
    // Block
    const newBlocks = (
      await Bluebird.mapSeries(chunk(blocks, 10000), (blockChunk) =>
        mgr.getRepository(BlockEntity).save(
          blockChunk.map((b) => ({
            chainId: b.chain_id,
            height: b.height,
            timestamp: b.timestamp
          }))
        )
      )
    ).flat()

    // Tx
    const txs = await src.getRepository(TxEntity).find({ order: { timestamp: 'ASC' }, relations: ['block'] })
    console.log(txs.length, txs[0])

    const newTxs = await mgr.getRepository(TxEntity).save(
      txs.map((tx) => ({
        chainId: tx.chainId,
        hash: tx.hash,
        timestamp: tx.timestamp,
        data: tx.data,
        block: newBlocks[tx.block.height - 1]
      }))
    )
    console.log(newTxs[0])
  })
}

async function start() {
  const conns = await initORM()
  await migrate()
  await Promise.all(conns.map((c) => c.close()))
}

start().catch(console.error)
