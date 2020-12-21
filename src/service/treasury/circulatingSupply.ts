import { getRepository } from 'typeorm'
import { UnvestedEntity } from 'orm'
import { minus, div } from 'lib/math'
import { currencyToDenom, isActiveCurrency } from 'lib/common'
import memoizeCache from 'lib/memoizeCache'
import config from 'config'
import { getTotalSupply } from './totalSupply'
import { isToken, getCirculatingSupply as getTokenCirculatingSupply } from './token'
import getLunaBalance from './getLunaBalance'

const getLunaBalanceMemoized = memoizeCache(getLunaBalance, { promise: true, maxAge: 5 * 60 * 1000 /* 5 minutes */ })

export async function getCirculatingSupply(input: string): Promise<string> {
  if (isToken(input)) {
    return getTokenCirculatingSupply(input)
  }

  const denom = isActiveCurrency(input) ? currencyToDenom(input.toLowerCase()) : input
  const totalSupply = await getTotalSupply(denom)
  const unvested = await getRepository(UnvestedEntity).find({
    where: {
      denom
    },
    order: {
      id: 'DESC'
    },
    take: 1
  })

  let circulatingSupply = unvested.length === 0 ? totalSupply : minus(totalSupply, unvested[0].amount)

  if (denom === 'uluna' && config.FOUNDATION_WALLET_ADDRESS) {
    circulatingSupply = minus(circulatingSupply, await getLunaBalanceMemoized(config.FOUNDATION_WALLET_ADDRESS))
  }

  return input !== denom ? div(circulatingSupply, 1000000) : circulatingSupply
}
