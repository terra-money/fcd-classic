import { getRepository, getConnection } from 'typeorm'
import { GeneralInfoEntity } from 'orm'
import { subDays } from 'date-fns'

import { div } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'
import * as lcd from 'lib/lcd'
import { errorReport } from 'lib/errorReporting'
import { getQueryDateTime } from 'lib/time'

export async function getTotalAccount(timestamp?: number): Promise<number> {
  const now = timestamp || Date.now()
  const targetDate = getQueryDateTime(now)
  const query = `select count(*) from (select distinct account from account_tx where timestamp <= '${targetDate}') as temp;`
  const res = await getConnection().query(query)
  return res && res.length ? res[0].count : 0
}

export async function getActiveAccount(timestamp?: number): Promise<number> {
  const now = timestamp || Date.now()
  const targetDate = getQueryDateTime(now)
  const onedayBefore = getQueryDateTime(subDays(now, 1))

  const query = `select count(*) from (select distinct account from account_tx where timestamp <= '${targetDate}' and timestamp >= '${onedayBefore}') as temp;`
  const res = await getConnection().query(query)
  return res && res.length ? res[0].count : 0
}

export async function saveGeneral() {
  const taxRate = await lcd.getTaxRate()
  const stakingPool = await lcd.getStakingPool()
  const taxProceeds = await lcd.getTaxProceeds()
  const seigniorageProceeds = await lcd.getSeigniorageProceeds()
  const communityPoolList = await lcd.getCommunityPool()

  const communityPool: DenomMap = communityPoolList.reduce((acc, { denom, amount }) => {
    acc[denom] = amount
    return acc
  }, {})

  const activeDenoms = await lcd.getOracleActives()
  const taxCaps: DenomTaxCap[] = await Promise.all(
    activeDenoms.map(async (denom: string) => {
      return {
        denom,
        taxCap: await lcd.getTaxCap(denom)
      }
    })
  )

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
