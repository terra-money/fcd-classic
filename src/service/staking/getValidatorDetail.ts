import { getRepository } from 'typeorm'
import { filter } from 'lodash'

import config from 'config'
import { ValidatorInfoEntity } from 'orm'

import * as lcd from 'lib/lcd'
import { sortDenoms } from 'lib/common'
import { div, plus } from 'lib/math'
import { localCache } from 'lib/cache'

import { getBalance } from 'service/bank'

import { getValidatorAnnualAvgReturn } from './getValidatorReturn'
import { getCommissions, getMyDelegation, getUndelegateSchedule, generateValidatorResponse } from './helper'

interface RewardsByDenom {
  denom: string
  amount: string
  adjustedAmount: string
}

interface ValidatorDetailsReturn extends ValidatorResponse {
  commissions?: Coin[]
  myDelegation?: string
  myDelegatable?: string
  myUndelegation?: UndeligationSchedule[]
  myRewards?: RewardsByDenom[]
}

function getSelfDelegation(
  delegators: Delegator[],
  accountAddr: string
): {
  amount: string
  weight: string
} {
  const selfDelegations = delegators.filter((d) => d.address === accountAddr)
  return selfDelegations.length > 0
    ? {
        amount: selfDelegations[0].amount,
        weight: selfDelegations[0].weight
      }
    : { amount: '0', weight: '0' }
}

async function getValidatorInfo(operatorAddr: string): Promise<ValidatorResponse | undefined> {
  const validator = await getRepository(ValidatorInfoEntity).findOne({
    operatorAddress: operatorAddr,
    chainId: config.CHAIN_ID
  })
  const { stakingReturn, isNewValidator } = await getValidatorAnnualAvgReturn(operatorAddr)

  if (validator) {
    return generateValidatorResponse(validator, { stakingReturn, isNewValidator })
  }

  return undefined
}

export async function getValidatorDetailUncached(
  operatorAddr: string,
  account?: string
): Promise<ValidatorDetailsReturn | undefined> {
  const validator = await getValidatorInfo(operatorAddr)

  if (!validator) {
    return
  }

  let result = {
    ...validator
  }

  if (account) {
    const priceObj = await lcd.getActiveOraclePrices()
    const commissions: Coin[] = await getCommissions(operatorAddr)
    const myDelegation = await getMyDelegation(account, validator)
    const myBalance = await getBalance(account)
    const ulunaBalance = filter(myBalance.balance, { denom: 'uluna' })[0]
    const myUndelegation =
      myBalance.unbondings &&
      getUndelegateSchedule(filter(myBalance.unbondings, { validator_address: operatorAddr }), {
        [operatorAddr]: validator
      })

    let myRewards

    if (myDelegation) {
      const rewards = await lcd.getRewards(account, operatorAddr)

      let total = '0'
      const denoms = rewards.map(({ denom, amount }) => {
        const adjustedAmount = denom === 'uluna' ? amount : priceObj[denom] ? div(amount, priceObj[denom]) : 0
        total = plus(total, adjustedAmount)
        return { denom, amount, adjustedAmount }
      })

      myRewards = {
        total,
        denoms
      }
    }

    result = {
      ...result,
      ...{ commissions: sortDenoms(commissions) },
      ...{
        myDelegation,
        myUndelegation,
        myDelegatable: ulunaBalance && ulunaBalance.delegatable,
        myRewards
      }
    }
  }

  return result
}

export const getValidatorDetail = localCache(getValidatorDetailUncached, {
  promise: true,
  maxAge: 300 * 1000 /* 5 minutes */
})
export default getValidatorDetail
