import { getRepository, getConnection } from 'typeorm'
import { subDays, startOfDay } from 'date-fns'

import { GeneralInfoEntity } from 'orm'
import { div } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'
import * as lcd from 'lib/lcd'
import { errorReport } from 'lib/errorReporting'
import { getQueryDateTime } from 'lib/time'

export async function getTotalAccount(timestamp?: number): Promise<number> {
  const now = timestamp || Date.now()
  const targetDate = getQueryDateTime(now)
  const query = `SELECT COUNT(*) FROM (SELECT DISTINCT account FROM account_tx WHERE timestamp <= '${targetDate}') AS t;`
  const res = await getConnection().query(query)
  return res && res.length ? res[0].count : 0
}

export async function getActiveAccount(timestamp?: number): Promise<number> {
  const now = timestamp || Date.now()
  const targetDate = getQueryDateTime(now)
  const onedayBefore = timestamp ? getQueryDateTime(subDays(now, 1)) : getQueryDateTime(startOfDay(now))
  const query = `SELECT COUNT(*) FROM (SELECT DISTINCT account FROM account_tx WHERE timestamp <= '${targetDate}' AND timestamp >= '${onedayBefore}') AS t;`
  const res = await getConnection().query(query)
  return res && res.length ? res[0].count : 0
}

export async function saveGeneral() {
  const [taxRate, taxProceeds, seigniorageProceeds, communityPoolList, activeDenoms] = await Promise.all([
    lcd.getTaxRate(),
    lcd.getTaxProceeds(),
    lcd.getSeigniorageProceeds(),
    lcd.getCommunityPool(),
    lcd.getOracleActives()
  ])

  const communityPool: DenomMap = communityPoolList.reduce((acc, { denom, amount }) => {
    acc[denom] = amount
    return acc
  }, {})

  const taxCaps: DenomTaxCap[] = await Promise.all(
    activeDenoms.map(async (denom: string) => {
      return {
        denom,
        taxCap: await lcd.getTaxCap(denom)
      }
    })
  )

  const { bonded_tokens: bondedTokens, not_bonded_tokens: notBondedTokens } = await lcd.getStakingPool()

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
    totalAccountCount: total,
    activeAccountCount: active,
    issuances,
    taxCaps,
    communityPool
  })
}

export async function collectorGeneral() {
  await saveGeneral()
    .then(() => {
      logger.info(`Save general - success.`)
    })
    .catch((e) => {
      logger.error(e)
      errorReport(e)
    })
}
