import { init as initORM, RewardEntity } from 'orm'
import { getRepository } from 'typeorm'
import { getRewardDocs } from 'collector/reward'
import * as moment from 'moment'

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

  const genesisStart = moment('2019-11-24 16:43:00').valueOf()
  for (let i = 0; i < 39; i = i + 1) {
    const datetime = moment(genesisStart).add(i, 'days')
    const end = datetime.valueOf() + 86400000

    // if (i === 0) datetime.add(15,'hours')
    datetime.add(1, 'minute')
    while (datetime.valueOf() < end) {
      const docs = await getRewardDocs(datetime.valueOf())
      docs.map((doc) => {
        if (doc.tax !== '0' || doc.gas !== '0' || doc.oracle !== '0') {
          console.log(doc)
        }
      })
      // await Promise.all(docs.map(upsert));
      // console.log(`Set reward completed. ${datetime.format('YYYY-MM-DD HH:mm:ss')}`);
      datetime.add(1, 'minute')
    }
  }
}

main().catch(console.error)
