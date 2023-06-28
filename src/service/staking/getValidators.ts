import { getRepository } from 'typeorm'
import { ValidatorInfoEntity } from 'orm'

export function getValidators(): Promise<ValidatorResponse[]> {
  return getRepository(ValidatorInfoEntity)
    .find({ order: { votingPowerWeight: 'DESC' } })
    .then((validators) => validators.map((v) => v.createResponse()))
}
