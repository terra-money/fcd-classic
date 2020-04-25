import { getRepository, getConnection } from 'typeorm'
import { GeneralInfoEntity } from 'orm'
import * as moment from 'moment'

import { div } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'
import * as lcd from 'lib/lcd'
import { errorReport } from 'lib/errorReporting'

export async function getTotalAccount(timestamp?: number) {
  const now = timestamp || Date.now()
  const targetDate = moment(now).format('YYYY-MM-DD HH:mm:ss')
  const query = `select count(*) from (select distinct account from account_tx where timestamp <= '${targetDate}') as temp;`
  return getConnection().query(query)
}

export async function getActiveAccount(timestamp?: number) {
  const now = timestamp || Date.now()
  const targetDate = moment(now).format('YYYY-MM-DD HH:mm:ss')
  const onedayBefore = moment(now).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss')

  const query = `select count(*) from (select distinct account from account_tx where timestamp <= '${targetDate}' and timestamp >= '${onedayBefore}') as temp;`
  return getConnection().query(query)
}

export async function saveGeneral() {
  const taxRate = await lcd.getTaxRate()
  const stakingPool = await lcd.getStakingPool()
  const taxProceeds = await lcd.getTaxProceeds()
  const seigniorageProceeds = await lcd.getSeigniorageProceeds()

  const { bonded_tokens: bondedTokens, not_bonded_tokens: notBondedTokens } = stakingPool
  const issuances = await lcd.getAllActiveIssuance()
  const stakingRatio = div(bondedTokens, issuances['uluna'])

  const now = Date.now()
  const datetime = new Date(now - (now % 60000) - 60000)

  const [total, active] = await Promise.all([getTotalAccount(), getActiveAccount()])

  await getRepository(GeneralInfoEntity).save({
    datetime,
    currentEpoch: undefined,
    taxRate: taxRate ? Number(taxRate) : NaN,
    stakingRatio: stakingRatio ? Number(stakingRatio) : NaN,
    taxProceeds,
    seigniorageProceeds,
    bondedTokens,
    notBondedTokens,
    totalAccountCount: total[0].count,
    activeAccountCount: active[0].count
  })
}

export async function setGeneral() {
  await saveGeneral()
    .then(() => {
      logger.info(`Save general - success.`)
    })
    .catch((e) => {
      logger.error(e)
      errorReport(e)
    })
}
