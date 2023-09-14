import { getRepository } from 'typeorm'
import { PriceEntity, GeneralInfoEntity } from 'orm'

interface StakingPoolInfo {
  stakingRatio: string // bigint value
  bondedTokens: string // bigint value
  notBondedTokens: string // bigint value
}

interface GeneralInfoReturn {
  prices: DenomMap
  issuances: DenomMap
  communityPool: DenomMap
  taxCaps: DenomTaxCap[]
  stakingPool: StakingPoolInfo
  taxRate: string // tax rate big int
}

async function getLatestGenInfo(): Promise<GeneralInfoEntity> {
  return await getRepository(GeneralInfoEntity).findOneOrFail({
    order: {
      datetime: 'DESC'
    }
  })
}

export default async function getGeneralInfo(): Promise<GeneralInfoReturn> {
  const prices = await PriceEntity.queryLatestPrices()
  const latestInfo = await getLatestGenInfo()
  const { taxRate, issuances, communityPool, bondedTokens, notBondedTokens, stakingRatio, taxCaps } = latestInfo

  return {
    prices,
    taxRate: taxRate.toString(),
    taxCaps,
    issuances,
    stakingPool: {
      stakingRatio: stakingRatio.toString(),
      bondedTokens,
      notBondedTokens
    },
    communityPool
  }
}
