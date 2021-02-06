import * as Bluebird from 'bluebird'
import { getManager, EntityManager, getRepository } from 'typeorm'
import { chunk } from 'lodash'
import { init as initORM, AccountEntity } from 'orm'

const updateTxsAccount = async () => {
  const totalAddresses = (await getRepository(AccountEntity).createQueryBuilder().select('address').getRawMany()).map(
    (e) => e.address
  )

  console.log(`Total ${totalAddresses.length}, ${totalAddresses[0]}`)

  // update 5000 at a time
  return Bluebird.mapSeries(chunk(totalAddresses, 1000), async (addresses, chunkIndex) => {
    await getManager().transaction(async (mgr: EntityManager) => {
      await mgr
        .getRepository(AccountEntity)
        .createQueryBuilder()
        .select('address')
        .where('address IN (:...addresses)', { addresses })
        .setLock('pessimistic_write')
        .getRawMany()

      const results = await mgr.query(
        `SELECT DISTINCT ON (address) a.address, COUNT(*) as txcount, MIN(a.created_at) as created_at FROM (SELECT account AS "address", MIN(timestamp) AS "created_at" FROM "account_tx" "AccountTxEntity" WHERE account IN (${addresses
          .map((a) => `'${a}'`)
          .join(',')}) GROUP BY account, timestamp) as a GROUP BY a.address`
      )

      await Promise.all(
        results.map(({ address, created_at, txcount }) =>
          mgr.update(AccountEntity, { address }, { txcount, createdAt: created_at })
        )
      )

      const progress = (chunkIndex + 1) * addresses.length
      console.log(`Updating ${progress} ${((progress / totalAddresses.length) * 100).toFixed(2)}%`)
    })
  })
}

async function start() {
  await initORM()
  await updateTxsAccount()
}

start().catch(console.error)
