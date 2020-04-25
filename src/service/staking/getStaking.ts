import { filter, chain, keyBy } from 'lodash'
import * as lcd from 'lib/lcd'
import getDelegations from 'lib/getDelegations'
import { plus, div } from 'lib/math'
import { sortDenoms } from 'lib/common'
import { getBalance } from '../bank'
import getValidators from './getValidators'
import { getUndelegateSchedule } from './helper'

function getTotalRewardsAdjustedToLuna(rewards: { denom: string; amount: string }[], prices: CoinByDenoms): string {
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
  delegator: DelegationInfo,
  validator: ValidatorResponse,
  prices: CoinByDenoms
): Promise<MyDelegation> {
  const rewards = await lcd.getRewards(delegator.delegator_address, delegator.validator_address)
  const adjustedRewards = rewards && prices && getTotalRewardsAdjustedToLuna(rewards, prices)

  return {
    validatorName: validator.description.moniker,
    validatorAddress: validator.operatorAddress,
    validatorStatus: validator.status,
    amountDelegated: delegator.amount,
    rewards: sortDenoms(rewards),
    totalReward: adjustedRewards
  }
}

async function getMyDelegations(
  delegations: DelegationInfo[],
  validatorObj: { [validatorAddress: string]: ValidatorResponse },
  prices: CoinByDenoms
): Promise<MyDelegation[]> {
  const myDelegations = await Promise.all(
    delegations.map(
      (item: DelegationInfo): Promise<MyDelegation> => {
        return (
          validatorObj[item.validator_address] && getMyDelegation(item, validatorObj[item.validator_address], prices)
        )
      }
    )
  )

  return myDelegations
    ? chain(myDelegations)
        .compact()
        .orderBy([(delegation): number => Number(delegation.amountDelegated)], ['desc'])
        .value()
    : []
}

function getDelegationTotal(delegations: DelegationInfo[]): string {
  return (
    delegations &&
    delegations.reduce((acc, curr) => {
      return curr.amount ? plus(acc, curr.amount) : acc
    }, '0')
  )
}

interface UserValidatorWithDelegationInfo extends ValidatorResponse {
  myDelegation?: string // user delegation amount
  myUndelegation?: UndeligationSchedule // user undelegation schedule with amount and info
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
    const myUndelegation = filter(myUndelegations, { validatorAddress: validator.operatorAddress })

    return Object.assign(validator, myDelegation && { myDelegation }, myUndelegation && { myUndelegation })
  })
}

interface GetStakingReturn {
  validators: UserValidatorWithDelegationInfo[] // Validator info with user delegation and rewards (Extends with ValidatorReturn)
  delegationTotal?: string // user total delegation
  undelegations?: UndeligationSchedule[] // User undelegation info
  rewards?: {
    total: string // total rewards
    denoms: Coin[] // rewards by denom
  }
  myDelegations?: MyDelegation[] // users delegation with validators info //TODO: this info already contains in validators list
  availableLuna?: string // available user luna
}

export default async function getStaking(address: string): Promise<GetStakingReturn> {
  if (!address) {
    const validators = await getValidators()
    return { validators }
  }

  // Base Data 수집
  const [delegations, validators, prices, allRewards, balance] = await Promise.all([
    getDelegations(address),
    getValidators(),
    lcd.getActiveOraclePrices(),
    lcd.getAllRewards(address),
    getBalance(address)
  ])
  const validatorObj = keyBy(validators, 'operatorAddress')

  // balance
  const delegationTotal = delegations ? getDelegationTotal(delegations) : '0'
  const myUndelegations = balance.unbondings ? getUndelegateSchedule(balance.unbondings, validatorObj) : []
  const delegatable =
    filter(balance.balance, { denom: 'uluna' }).length > 0
      ? filter(balance.balance, { denom: 'uluna' })[0].delegatable
      : '0'

  // rewards
  const totalReward = allRewards ? getTotalRewardsAdjustedToLuna(allRewards, prices) : '0'

  // my delegations
  const myDelegations = await getMyDelegations(delegations, validatorObj, prices)

  return {
    delegationTotal,
    undelegations: myUndelegations,
    rewards: {
      total: totalReward,
      denoms: allRewards ? sortDenoms(allRewards) : []
    },
    validators: joinValidatorsWithMyDelegation(validators, myDelegations, myUndelegations),
    myDelegations,
    availableLuna: delegatable
  }
}
