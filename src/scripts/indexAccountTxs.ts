import * as Bluebird from 'bluebird'
import { getManager } from 'typeorm'
import { init, TxEntity, AccountTxEntity } from 'orm'
import { countBy, chunk, uniqBy } from 'lodash'
import { generateAccountTxs } from 'collector/block'
import * as token from 'service/token'

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
          tx_id: number
        }[] = await mgr
          .createQueryBuilder(AccountTxEntity, 'a')
          .select(['a.id', 'account', 'tx_id'])
          .leftJoin(TxEntity, 'tx', 'tx.id = a.tx_id')
          .andWhere('tx.id IN(:...ids)', { ids: txEntities.map((t) => t.id) })
          .getRawMany() // getRawMany trick for saving memory

        console.log(`existings: ${existings.length}`)

        // Determine AccountTxs to be deleted
        const accountTxIdsForDeletion: number[] = []
        const uniqueExistings = uniqBy(existings, (e) => `${e.account}${e.tx_id}`)

        existings.forEach((e) => {
          // const { account, tx_id } = e
          if (uniqueExistings.findIndex((u) => u.account === e.account && u.a_id === e.a_id) === -1) {
            accountTxIdsForDeletion.push(e.a_id)
          }
          // else if (accountTxs.findIndex((a) => a.account === account && a.tx.id === tx_id) === -1) {
          //   accountTxIdsForDeletion.push(e.a_id)
          // }
        })

        // Delete from the database
        if (accountTxIdsForDeletion.length) {
          console.log(`deletions: ${accountTxIdsForDeletion.length}`)
          await Bluebird.mapSeries(chunk(accountTxIdsForDeletion, 5000), (chunk) => mgr.delete(AccountTxEntity, chunk))
        }

        // Determine AccountTxs for insertion
        const accountTxForInsertion = accountTxs.filter((accountTx) => {
          const { account, tx } = accountTx
          return existings.findIndex((e) => e.account === account && e.tx_id === tx.id) === -1
        })

        // Insert to the database
        if (accountTxForInsertion.length) {
          console.log(`insertions: ${accountTxForInsertion.length}`)
          await Bluebird.mapSeries(chunk(accountTxForInsertion, 5000), (chunk) => mgr.insert(AccountTxEntity, chunk))
          console.log(countBy(accountTxForInsertion, 'account'))
        }

        currTxId = txEntities[txEntities.length - 1].id
        console.log(`moving cursor to ${currTxId} at ${txEntities[txEntities.length - 1].timestamp}`)
      })
      .catch((err) => console.error(err))
  }

  await Promise.all(conns.map((c) => c.close()))
}

main().catch(console.error)
