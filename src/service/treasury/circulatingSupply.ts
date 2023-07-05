import * as Bluebird from 'bluebird'
import { getRepository } from 'typeorm'
import { UnvestedEntity } from 'orm'
import { minus, div, plus } from 'lib/math'
import { currencyToDenom, isActiveCurrency } from 'lib/common'
import memoizeCache from 'lib/memoizeCache'
import * as lcd from 'lib/lcd'
import config from 'config'
import { getTotalSupply } from './totalSupply'
import { isToken, getCirculatingSupply as getTokenCirculatingSupply } from 'service/token'
import getLunaBalance from './getLunaBalance'
import { BOND_DENOM } from 'lib/constant'

const getLunaBalanceMemoized = memoizeCache(getLunaBalance, { promise: true, maxAge: 5 * 60 * 1000 /* 5 minutes */ })

export async function getCirculatingSupply(input: string): Promise<string> {
  if (isToken(input)) {
    return getTokenCirculatingSupply(input)
  }

  const denom = isActiveCurrency(input) ? currencyToDenom(input.toLowerCase()) : input
  const [totalSupply, communityPool] = await Promise.all([getTotalSupply(denom), lcd.getCommunityPool()])
  const unvested = await getRepository(UnvestedEntity).find({
    where: {
      denom
    },
    order: {
      id: 'DESC'
    },
    take: 1
  })

  // Initialize circualating supply to total supply
  let circulatingSupply = totalSupply

  // Remove unvested amount
  if (unvested.length) {
    circulatingSupply = minus(circulatingSupply, unvested[0].amount)
  }

  // Special conditions for Luna
  if (denom === BOND_DENOM) {
    // Remove Luna in community pool
    if (communityPool) {
      circulatingSupply = minus(circulatingSupply, communityPool.find((c) => c.denom === denom)?.amount || '0')
    }

    // Remove Luna in bank wallets
    if (config.BANK_WALLETS.length !== 0) {
      const total = await Bluebird.reduce(
        config.BANK_WALLETS,
        (acc, cur) => getLunaBalanceMemoized(cur).then((balance) => plus(acc, balance)),
        '0'
      )
      circulatingSupply = minus(circulatingSupply, total)
    }
  }

  return input !== denom ? div(circulatingSupply, 1000000) : circulatingSupply
}
