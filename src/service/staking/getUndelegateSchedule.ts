import { get, orderBy } from 'lodash'

export function getUndelegateSchedule(
  unbondings: LcdStakingUnbonding[],
  validatorObj: { [validatorAddress: string]: ValidatorResponse }
): UndeligationSchedule[] {
  return orderBy(
    unbondings
      .map((unbonding: LcdStakingUnbonding) => {
        const { validator_address, entries } = unbonding
        const validatorName: string = get(validatorObj, `${validator_address}`).description.moniker
        const validatorStatus: string = get(validatorObj, `${validator_address}`).status
        return entries.map((entry: LcdStakingEntry) => {
          return {
            releaseTime: entry.completion_time,
            amount: entry.balance,
            validatorName,
            validatorAddress: validator_address,
            validatorStatus,
            creationHeight: entry.creation_height
          }
        })
      })
      .flat(),
    ['releaseTime'],
    ['asc']
  )
}
