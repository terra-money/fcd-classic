import { getRepository, EntityManager } from 'typeorm'
import { GeneralInfoEntity } from 'orm'
import { div } from 'lib/math'
import * as lcd from 'lib/lcd'
import { getStartOfPreviousMinuteTs } from 'lib/time'
import { collectorLogger as logger } from 'lib/logger'
import { BOND_DENOM } from 'lib/constant'

export async function collectGeneral(mgr: EntityManager, timestamp: number, strHeight: string) {
  const [
    taxRate,
    taxProceeds,
    seigniorageProceeds,
    communityPool,
    taxCaps,
    { bondedTokens, notBondedTokens, issuances, stakingRatio }
  ] = await Promise.all([
    lcd.getTaxRate(strHeight),
    lcd.getTaxProceeds(strHeight),
    lcd.getSeigniorageProceeds(strHeight),
    lcd.getCommunityPool(strHeight).then(
      (pool): DenomMap =>
        Array.isArray(pool)
          ? pool.reduce((acc, { denom, amount }) => {
              acc[denom] = amount
              return acc
            }, {})
          : {}
    ),
    lcd
      .getTaxCaps(strHeight)
      .then((taxCaps) => taxCaps.map((taxCap): DenomTaxCap => ({ denom: taxCap.denom, taxCap: taxCap.tax_cap }))),
    Promise.all([lcd.getStakingPool(strHeight), lcd.getAllActiveIssuance(strHeight)]).then((results) => {
      const [{ bonded_tokens: bondedTokens, not_bonded_tokens: notBondedTokens }, issuances] = results
      return { bondedTokens, notBondedTokens, issuances, stakingRatio: div(bondedTokens, issuances[BOND_DENOM]) }
    })
  ])
  const datetime = new Date(getStartOfPreviousMinuteTs(timestamp))

  const genInfo: Partial<GeneralInfoEntity> = {
    datetime,
    taxRate: taxRate ? Number(taxRate) : NaN,
    stakingRatio: stakingRatio ? Number(stakingRatio) : NaN,
    taxProceeds,
    seigniorageProceeds,
    bondedTokens,
    notBondedTokens,
    issuances,
    taxCaps,
    communityPool
  }

  const prevGenInfo = await getRepository(GeneralInfoEntity).findOne({
    datetime
  })

  if (prevGenInfo) {
    await mgr.update(GeneralInfoEntity, prevGenInfo.id, genInfo)
  } else {
    await mgr.insert(GeneralInfoEntity, genInfo)
  }

  logger.info(`collectGeneral: ${genInfo.datetime}`)
}
