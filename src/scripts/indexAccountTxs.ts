import * as Bluebird from 'bluebird'
import { getManager } from 'typeorm'
import { init, TxEntity, AccountTxEntity } from 'orm'
import { countBy, chunk } from 'lodash'
import { generateAccountTxs } from 'collector/block'
import * as token from 'service/treasury/token'

async function main() {
  const conns = await init()
  await token.init()

  let done = false
  // first tx id
  let currTxId = 58488503 // first id of columbus-4
  // let currTxId = 58944546 // first contract type tx occurence of columbus-4

  while (!done) {
    await getManager()
      .transaction(async (mgr) => {
        // First get the Txs for generating AccountTxs
        const txEntities = await mgr
          .createQueryBuilder(TxEntity, 'tx')
          .select()
          .where('tx.id > :n', { n: currTxId })
          .orderBy('tx.id')
          .limit(10000)
          .getMany()

        if (txEntities.length === 0) {
          done = true
          return
        }

        // Generate AccountTxs
        const accountTxs: AccountTxEntity[] = txEntities.map(generateAccountTxs).flat()
        console.log(`accountTxs: ${accountTxs.length}`)

        // Get existing AccountTxs of existing Txs for determining whether it needs to be deleted or inserted
        const existings: {
          a_id: number
          account: string
          type: string
          tx_id: number
        }[] = await mgr
          .createQueryBuilder(AccountTxEntity, 'a')
          .select(['a.id', 'account', 'type', 'tx_id'])
          .leftJoin(TxEntity, 'tx', 'tx.id = a.tx_id')
          .andWhere('tx.id IN(:...ids)', { ids: txEntities.map((t) => t.id) })
          .getRawMany() // getRawMany trick for saving memory

        console.log(`existings: ${existings.length}`)

        // Determine AccountTxs to be deleted
        const accountTxsForDeletion: number[] = []

        existings.forEach((e) => {
          const { account, type, tx_id } = e

          if (accountTxs.findIndex((a) => a.account === account && a.type === type && a.tx.id === tx_id) === -1) {
            accountTxsForDeletion.push(e.a_id)
          }
        })

        // Delete from the database
        if (accountTxsForDeletion.length) {
          console.log(`deletions: ${accountTxsForDeletion.length}`)
          await Bluebird.mapSeries(chunk(accountTxsForDeletion, 5000), (chunk) => mgr.delete(AccountTxEntity, chunk))
        }

        // Determine AccountTxs to be inserted
        const newAccountTxs = accountTxs.filter((accountTx) => {
          const { account, type, tx } = accountTx
          return existings.findIndex((e) => e.account === account && e.type === type && e.tx_id === tx.id) === -1
        })

        // Save to the database
        console.log(`insertions: ${newAccountTxs.length}`)
        await Bluebird.mapSeries(chunk(newAccountTxs, 5000), (chunk) => mgr.save(chunk))
        console.log(countBy(newAccountTxs, 'account'))

        currTxId = txEntities[txEntities.length - 1].id
        console.log(`moving cursor to ${currTxId} at ${txEntities[txEntities.length - 1].timestamp}`)
      })
      .catch((err) => console.error(err))
  }

  await Promise.all(conns.map((c) => c.close()))
}

main().catch(console.error)
