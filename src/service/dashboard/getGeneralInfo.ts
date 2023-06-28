import { getRepository, MoreThanOrEqual } from 'typeorm'
import { subMinutes } from 'date-fns'

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

async function getLatestPrices(): Promise<DenomMap> {
  const prices = await getRepository(PriceEntity).find({
    where: {
      datetime: MoreThanOrEqual(subMinutes(new Date(), 5))
    },
    order: {
      datetime: 'DESC'
    }
  })

  return prices.reduce((priceMap: DenomMap, price: PriceEntity) => {
    if (!priceMap[price.denom]) {
      priceMap[price.denom] = price.price.toString()
    }
    return priceMap
  }, {} as DenomMap)
}

async function getLatestGenInfo(): Promise<GeneralInfoEntity> {
  return await getRepository(GeneralInfoEntity).findOneOrFail({
    order: {
      datetime: 'DESC'
    }
  })
}

export default async function getGeneralInfo(): Promise<GeneralInfoReturn> {
  const prices = await getLatestPrices()
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
