import { init as initORM, AccountEntity } from 'orm'
import { getRepository, getManager, EntityManager } from 'typeorm'

async function updateCount(address: string) {
  await getManager().transaction(async (mgr: EntityManager) => {
    const accountRepo = mgr.getRepository(AccountEntity)
    const account = await accountRepo.findOneOrFail({ address }, { lock: { mode: 'pessimistic_write' } })

    const query = `
SELECT COUNT(*) FROM
  (SELECT DISTINCT(hash)
    FROM account_tx
    WHERE account='${address}') t`

    const totalCntResult = await mgr.query(query)
    const txcount = totalCntResult[0].count

    account.txcount = +txcount
    await accountRepo.save(account)
  })
}

async function main() {
  await initORM()
  const limit = 100
  const accountCnt = await getRepository(AccountEntity).count()

  for (let j = 0; j < Math.ceil(accountCnt / limit); j += 1) {
    console.log(`Update ${j} Start`)
    const accounts = await getRepository(AccountEntity).find({
      skip: j * limit,
      take: limit
    })

    await Promise.all(accounts.map((account) => updateCount(account.address)))
    console.log(`Update ${j} Completed`)
  }
}

main().catch(console.error)
