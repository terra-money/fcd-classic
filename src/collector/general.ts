import * as Bluebird from 'bluebird'
import { getRepository, DeepPartial } from 'typeorm'

import { GeneralInfoEntity } from 'orm'

import { div } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'
import * as lcd from 'lib/lcd'
import { errorReport } from 'lib/errorReporting'
import { getStartOfPreviousMinuteTs } from 'lib/time'
import { timeoutPromise } from 'lib/timeoutPromise'
import { PROMISE_MAX_TIMEOUT_MS } from 'lib/constant'

export async function saveGeneral() {
  const genInfoPromises = Promise.all([
    lcd.getTaxRate(),
    lcd.getTaxProceeds(),
    lcd.getSeigniorageProceeds(),
    lcd.getCommunityPool().then(
      (pool): DenomMap =>
        pool.reduce((acc, { denom, amount }) => {
          acc[denom] = amount
          return acc
        }, {})
    ),
    lcd.getOracleActives().then((activeDenoms) =>
      Bluebird.map(activeDenoms, async (denom: string) => {
        const taxCap = await lcd.getTaxCap(denom)
        return { denom, taxCap }
      })
    ),

    Promise.all([lcd.getStakingPool(), lcd.getAllActiveIssuance()]).then((results) => {
      const [{ bonded_tokens: bondedTokens, not_bonded_tokens: notBondedTokens }, issuances] = results
      return { bondedTokens, notBondedTokens, issuances, stakingRatio: div(bondedTokens, issuances['uluna']) }
    })
  ])

  const [
    taxRate,
    taxProceeds,
    seigniorageProceeds,
    communityPool,
    taxCaps,
    { bondedTokens, notBondedTokens, issuances, stakingRatio }
  ] = await timeoutPromise(genInfoPromises, PROMISE_MAX_TIMEOUT_MS, 'Failed in timeout getting general info')

  const now = Date.now()
  const datetime = new Date(getStartOfPreviousMinuteTs(now))

  const genInfo: DeepPartial<GeneralInfoEntity> = {
    datetime,
    currentEpoch: undefined,
    taxRate: taxRate ? Number(taxRate) : NaN,
    stakingRatio: stakingRatio ? Number(stakingRatio) : NaN,
    taxProceeds,
    seigniorageProceeds,
    bondedTokens,
    notBondedTokens,
    totalAccountCount: 0, // TODO: legacy column. Will be removed on next release
    activeAccountCount: 0, // TODO: legacy column. Will be removed on next release
    issuances,
    taxCaps,
    communityPool
  }

  await timeoutPromise(
    saveOrUpdateGeneralInfo(datetime, genInfo),
    PROMISE_MAX_TIMEOUT_MS,
    'Timeout while saving general info'
  )
}

async function saveOrUpdateGeneralInfo(datetime: Date, genInfo: DeepPartial<GeneralInfoEntity>) {
  const prevGenInfo = await getRepository(GeneralInfoEntity).findOne({
    datetime
  })

  if (prevGenInfo) {
    await getRepository(GeneralInfoEntity).update(prevGenInfo.id, genInfo)
  } else {
    await getRepository(GeneralInfoEntity).save(genInfo)
  }
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
