import * as Bluebird from 'bluebird'
import config from 'config'
import { compact } from 'lodash'
import {
  getActiveOraclePrices,
  getTaxRate,
  getTaxCap,
  getAllActiveIssuance,
  getStakingPool,
  getCommunityPool
} from 'lib/lcd'
import { div } from 'lib/math'

interface StakingPoolInfo {
  stakingRatio: string // bigint value
  bondedTokens: string // bigint value
  notBondedTokens: string // bigint value
}

interface DenomTaxCap {
  denom: string // denom name
  taxCap: string // tax cap for denom
}

interface GeneralInfoReturn {
  prices: CoinByDenoms
  issuances: CoinByDenoms
  communityPool: CoinByDenoms
  taxCaps: DenomTaxCap[]
  stakingPool: StakingPoolInfo
  taxRate: string // tax rate big int
}

export default async function getGeneralInfo(): Promise<GeneralInfoReturn> {
  const pricesReq = getActiveOraclePrices()
  const taxRateReq = getTaxRate()
  const issuanceReq = getAllActiveIssuance()
  const stakingPoolReq = getStakingPool()
  const communityPoolReq = getCommunityPool()

  const taxCaps: DenomTaxCap[] = await Bluebird.map(
    config.TAX_CAP_TARGETS,
    (denom): Promise<DenomTaxCap> => getTaxCap(denom).then((taxCap) => ({ denom, taxCap }))
  )

  const [
    prices,
    taxRate,
    issuances,
    { not_bonded_tokens: notBondedTokens, bonded_tokens: bondedTokens },
    communityPool
  ] = await Promise.all([pricesReq, taxRateReq, issuanceReq, stakingPoolReq, communityPoolReq])

  const communityPoolObj = {}
  compact(communityPool).forEach((item) => {
    communityPoolObj[item.denom] = item.amount
  })

  const stakingPool = {
    stakingRatio: div(bondedTokens, issuances['uluna']),
    bondedTokens,
    notBondedTokens
  }
  return {
    prices,
    taxRate,
    taxCaps,
    issuances,
    stakingPool,
    communityPool: communityPoolObj
  }
}
