import { init as initORM, RewardEntity } from 'orm'
import { getRepository } from 'typeorm'
import { getRewardDocs } from 'collector/reward'

async function upsert(doc: RewardEntity) {
  const isExists = await getRepository(RewardEntity).findOne({
    denom: doc.denom,
    datetime: doc.datetime
  })
  if (isExists) {
    await getRepository(RewardEntity).update(
      {
        denom: doc.denom,
        datetime: doc.datetime
      },
      doc
    )
  } else {
    await getRepository(RewardEntity).insert(doc)
  }
}

async function main() {
  await initORM()

  const genesisTs = new Date('2019-11-24 16:43:00').getTime()

  for (let i = 0; i < 39; i = i + 1) {
    let curTs = genesisTs + 86400000 * i
    const endTs = curTs + 86400000

    curTs += 60000

    while (curTs < endTs) {
      const docs = await getRewardDocs(curTs)

      docs.map((doc) => {
        if (doc.tax !== '0' || doc.gas !== '0' || doc.oracle !== '0') {
          console.log(doc)
        }
      })

      await Promise.all(docs.map(upsert))
      console.log(`Set reward completed. ${new Date(curTs).toUTCString()}`)
      curTs += 60000
    }
  }
}

main().catch(console.error)
