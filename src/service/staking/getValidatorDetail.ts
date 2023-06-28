import { getRepository } from 'typeorm'
import { filter } from 'lodash'

import { ValidatorInfoEntity } from 'orm'

import * as lcd from 'lib/lcd'
import { sortDenoms } from 'lib/common'
import { div, plus, times } from 'lib/math'
import memoizeCache from 'lib/memoizeCache'

import { getBalances } from 'service/bank'
import { getUndelegateSchedule } from './getUndelegateSchedule'

interface RewardsByDenom {
  denom: string
  amount: string
  adjustedAmount: string // in luna value
}

interface ValidatorDetailsReturn extends ValidatorResponse {
  commissions?: Coin[]
  myDelegation?: string
  myDelegatable?: string
  myUndelegation?: UndeligationSchedule[]
  myRewards?: {
    total: string
    denoms: RewardsByDenom[]
  }
  redelegations?: LCDStakingRelegation[]
}

export async function getValidatorDetailUncached(
  operatorAddress: string,
  account?: string
): Promise<ValidatorDetailsReturn | undefined> {
  const valInfo = await getRepository(ValidatorInfoEntity).findOne({ operatorAddress })

  if (!valInfo) {
    return
  }

  const validator = valInfo.createResponse()
  const commissions: Coin[] = sortDenoms(await lcd.getCommissions(operatorAddress))

  const result: ValidatorDetailsReturn = {
    ...validator,
    commissions
  }

  if (account) {
    const [delegation, redelegations] = await Promise.all([
      lcd.getDelegationForValidator(account, validator.operatorAddress),
      lcd.getRedelegations(account)
    ])

    result.redelegations = redelegations
    result.myDelegation =
      delegation?.delegation.shares &&
      div(times(delegation.delegation.shares, validator.tokens), validator.delegatorShares)

    // No delegation, no remain reward
    if (result.myDelegation) {
      const [priceObj, rewards] = await Promise.all([
        lcd.getActiveOraclePrices(),
        lcd.getRewards(account, operatorAddress)
      ])

      let total = '0'
      const denoms = rewards.map(({ denom, amount }) => {
        const adjustedAmount = denom === 'uluna' ? amount : priceObj[denom] ? div(amount, priceObj[denom]) : 0
        total = plus(total, adjustedAmount)
        return { denom, amount, adjustedAmount } as RewardsByDenom
      })

      result.myRewards = {
        total,
        denoms
      }
    }

    const myBalance = await getBalances(account)
    const ulunaBalance = filter(myBalance.balance, { denom: 'uluna' })[0]

    result.myDelegatable = ulunaBalance && ulunaBalance.delegatable

    const myUndelegation =
      myBalance.unbondings &&
      getUndelegateSchedule(filter(myBalance.unbondings, { validator_address: operatorAddress }), {
        [operatorAddress]: validator
      })

    result.myUndelegation = myUndelegation
  }

  return result
}

export const getValidatorDetail = memoizeCache(getValidatorDetailUncached, {
  promise: true,
  maxAge: 10 * 1000 // 10 seconds
})
