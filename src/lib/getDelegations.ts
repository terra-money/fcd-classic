import * as lcd from 'lib/lcd'
import { times, div, getIntegerPortion } from 'lib/math'

async function getDelegations(address: string, validators?: LcdValidator[]): Promise<DelegationInfo[]> {
  const delegations = await lcd.getDelegations(address)
  if (!delegations) {
    return []
  }

  const vals = validators || (await lcd.getValidators())

  const validatorObj = vals.reduce((acc, item) => {
    acc[item.operator_address] = item
    return acc
  }, {})

  const delegationMapper = (delegation: LcdDelegation): DelegationInfo => {
    const targetValidator = validatorObj[delegation.validator_address]
    return {
      delegator_address: delegation.delegator_address,
      validator_address: delegation.validator_address,
      shares: delegation.shares,
      amount:
        targetValidator &&
        getIntegerPortion(div(times(delegation.shares, targetValidator.tokens), targetValidator.delegator_shares))
    }
  }

  return delegations.map(delegationMapper)
}

export default getDelegations
