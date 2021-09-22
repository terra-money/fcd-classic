import { getRepository } from 'typeorm'
import { ValidatorInfoEntity } from 'orm'
import { generateValidatorResponse } from './helper'

export function getValidators(): Promise<ValidatorResponse[]> {
  return getRepository(ValidatorInfoEntity)
    .find({ order: { votingPowerWeight: 'DESC' } })
    .then((validators) => validators.map(generateValidatorResponse))
}
