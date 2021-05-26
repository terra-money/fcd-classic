import * as lcd from 'lib/lcd'

async function getDelegations(address: string): Promise<DelegationInfo[]> {
  const delegations = await lcd.getDelegations(address)

  return (delegations || []).map(
    ({ delegation, balance }): DelegationInfo => ({
      delegator_address: delegation.delegator_address,
      validator_address: delegation.validator_address,
      shares: delegation.shares,
      amount: balance.amount
    })
  )
}

export default getDelegations
