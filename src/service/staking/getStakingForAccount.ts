import { find, chain, keyBy } from 'lodash'

import * as lcd from 'lib/lcd'
import { getDelegations, DelegationInfo } from './getDelegations'
import { plus, div } from 'lib/math'
import { sortDenoms } from 'lib/common'
import memoizeCache from 'lib/memoizeCache'

import { getBalances } from '../bank'
import { getValidators } from './getValidators'
import { getUndelegateSchedule } from './getUndelegateSchedule'

function getTotalRewardsAdjustedToLuna(rewards: Coin[], prices: DenomMap): string {
  return rewards.reduce((acc, item) => {
    if (item.denom === 'uluna') {
      return plus(acc, item.amount)
    }

    return prices[item.denom] ? plus(acc, div(item.amount, prices[item.denom])) : acc
  }, '0')
}

interface MyDelegation {
  validatorName: string // delegated validators name (moniker)
  validatorAddress: string // validator address
  validatorStatus: string // validator status
  amountDelegated: string // delegated amount
  rewards: Coin[] // rewards by denoms
  totalReward: string // total rewards
}

async function getMyDelegation(
  delegation: DelegationInfo,
  validator: ValidatorResponse,
  prices: DenomMap
): Promise<MyDelegation> {
  const rewards = await lcd.getRewards(delegation.delegator_address, delegation.validator_address)
  const adjustedRewards = rewards && prices && getTotalRewardsAdjustedToLuna(rewards, prices)

  return {
    validatorName: validator.description.moniker,
    validatorAddress: validator.operatorAddress,
    validatorStatus: validator.status,
    amountDelegated: delegation.amount,
    rewards: sortDenoms(rewards),
    totalReward: adjustedRewards
  }
}

async function getMyDelegations(
  delegations: DelegationInfo[],
  validatorObj: { [validatorAddress: string]: ValidatorResponse },
  prices: DenomMap
): Promise<MyDelegation[]> {
  const myDelegations = await Promise.all(
    delegations.map((item: DelegationInfo): Promise<MyDelegation> => {
      return validatorObj[item.validator_address] && getMyDelegation(item, validatorObj[item.validator_address], prices)
    })
  )

  return myDelegations
    ? chain(myDelegations)
        .compact()
        .orderBy([(d) => Number(d.amountDelegated)], ['desc'])
        .value()
    : []
}

interface UserValidatorWithDelegationInfo extends ValidatorResponse {
  myDelegation?: string // user delegation amount
  myUndelegation?: UndeligationSchedule[] // user undelegation schedule with amount and info
}

function joinValidatorsWithMyDelegation(
  validators: ValidatorResponse[],
  myDelegations: MyDelegation[],
  myUndelegations: UndeligationSchedule[]
): UserValidatorWithDelegationInfo[] {
  const myDelegationsObj: { [validatorAddress: string]: MyDelegation } =
    myDelegations && keyBy(myDelegations, 'validatorAddress')
  return validators.map((validator) => {
    const myDelegation =
      myDelegationsObj &&
      myDelegationsObj[validator.operatorAddress] &&
      myDelegationsObj[validator.operatorAddress].amountDelegated
    const myUndelegation = myUndelegations.filter((d) => d.validatorAddress === validator.operatorAddress)

    return Object.assign(validator, myDelegation && { myDelegation }, myUndelegation && { myUndelegation })
  })
}

interface GetStakingResponse {
  validators: UserValidatorWithDelegationInfo[] // Validator info with user delegation and rewards
  redelegations: LCDStakingRelegation[]
  delegationTotal?: string // user total delegation
  undelegations?: UndeligationSchedule[] // User undelegation info
  rewards?: {
    total: string // total rewards
    denoms: Coin[] // rewards by denom
  }
  myDelegations?: MyDelegation[] // users delegation with validators info // TODO: this info already contains in validators list
  availableLuna?: string // available user luna
}

export async function getStakingUncached(address: string): Promise<GetStakingResponse> {
  // Fetch data
  const [validators, delegations, balance, redelegations, prices, totalRewards] = await Promise.all([
    getValidators(),
    getDelegations(address),
    getBalances(address),
    lcd.getRedelegations(address),
    lcd.getActiveOraclePrices(),
    lcd.getTotalRewards(address)
  ])
  const validatorObj = keyBy(validators, 'operatorAddress')

  // balance
  const delegationTotal = delegations.reduce((acc, curr) => plus(acc, curr.amount), '0')
  const myUndelegations = balance.unbondings ? getUndelegateSchedule(balance.unbondings, validatorObj) : []

  const lunaBalance = find(balance.balance, { denom: 'uluna' })
  const delegatable = lunaBalance ? lunaBalance.delegatable : '0'

  // rewards
  const totalReward = getTotalRewardsAdjustedToLuna(totalRewards, prices)

  // my delegations
  const myDelegations = await getMyDelegations(delegations, validatorObj, prices)

  return {
    validators: joinValidatorsWithMyDelegation(validators, myDelegations, myUndelegations),
    redelegations,
    delegationTotal,
    undelegations: myUndelegations,
    rewards: {
      total: totalReward,
      denoms: sortDenoms(totalRewards)
    },
    myDelegations,
    availableLuna: delegatable
  }
}

export const getStakingForAccount = memoizeCache(getStakingUncached, { promise: true, maxAge: 10 * 1000 })
