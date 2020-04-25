import { getRepository, getConnection, LessThan } from 'typeorm'
import * as moment from 'moment'
import { format } from 'date-fns'
import { init as initORM, GeneralInfoEntity } from 'orm'

async function getTotalAccount(now) {
  const query = `select count(*) from (select distinct account from account_tx where timestamp <= '${now}') as temp;`
  return getConnection().query(query)
}

async function getActiveAccount(now) {
  const onedayBefore = moment(now).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss')

  const query = `select count(*) from (select distinct account from account_tx where timestamp <= '${now}' and timestamp >= '${onedayBefore}') as temp;`
  return getConnection().query(query)
}

async function setDistinctAccount(data: GeneralInfoEntity) {
  const now = format(data.datetime, 'YYYY-MM-DD HH:mm:ss')

  const [total, active] = await Promise.all([getTotalAccount(now), getActiveAccount(now)])

  await getRepository(GeneralInfoEntity).update(data.id, {
    totalAccountCount: total[0].count,
    activeAccountCount: active[0].count
  })
}

async function getAllGeneral() {
  const generals = await getRepository(GeneralInfoEntity).find({
    where: {
      datetime: LessThan(new Date('2019-07-19 17:22:00'))
    },
    order: {
      datetime: 'ASC'
    }
  })
  for (let i = 3995; i < generals.length; i += 1) {
    await setDistinctAccount(generals[i])
  }
}

async function start() {
  await initORM()
  await getAllGeneral()
}

start().catch(console.error)
