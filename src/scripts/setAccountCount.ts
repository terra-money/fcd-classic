import { init as initORM, AccountEntity } from 'orm'
import { getRepository, getConnection } from 'typeorm'
import { get } from 'lodash'

async function updateCount(addr: string) {
  const connection = getConnection()
  const queryRunner = connection.createQueryRunner()
  await queryRunner.startTransaction()
  try {
    const lockQuery = `select * from account where address='${addr}' for update`
    await queryRunner.query(lockQuery)

    const query = `with distinctHashes as (select distinct(hash) from account_tx where \
      account='${addr}') select count(*) from distinctHashes`
    const totalCntResult = await queryRunner.query(query)
    const totalCnt = get(totalCntResult, '0.count', 0)
    const updateQuery = `update account set txcount=${totalCnt} where address='${addr}'`
    await queryRunner.query(updateQuery)

    // commit transaction now:
    await queryRunner.commitTransaction()
  } catch (err) {
    await queryRunner.rollbackTransaction()
  } finally {
    await queryRunner.release()
  }
  return
}

async function main() {
  await initORM()
  const limit = 100
  const accountCnt = await getRepository(AccountEntity).count()

  for (let j = 0; j < Math.ceil(accountCnt / limit); j = j + 1) {
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
