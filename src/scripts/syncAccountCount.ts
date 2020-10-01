import * as Bluebird from 'bluebird'
import { getManager, EntityManager, getRepository } from 'typeorm'
import { chunk } from 'lodash'
import { init as initORM, AccountEntity, AccountTxEntity } from 'orm'

const updateTxsAccount = async () => {
  await getManager().transaction(async (mgr: EntityManager) => {
    await mgr.query('ALTER SEQUENCE account_id_seq RESTART')
    await mgr.query('DELETE FROM account')

    const results = await getRepository(AccountTxEntity)
      .createQueryBuilder()
      .select('account', 'address')
      .addSelect('MIN(timestamp)', 'created_at')
      .addSelect('COUNT(*)', 'txcount')
      .groupBy('account')
      .orderBy('created_at')
      .getRawMany()

    await Bluebird.mapSeries(chunk(results, 1000), (arr) =>
      mgr
        .save(
          arr.map(({ address, created_at, txcount }) => {
            const entity = new AccountEntity()

            entity.address = address
            entity.createdAt = created_at
            entity.txcount = txcount

            return entity
          })
        )
        .then(() => console.log(`${arr.length} rows inserted`))
    )
  })
}

async function start() {
  await initORM()
  await updateTxsAccount()
}

start().catch(console.error)
