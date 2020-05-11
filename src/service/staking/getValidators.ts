import { orderBy } from 'lodash'
import { getRepository, getConnection } from 'typeorm'
import config from 'config'
import { generateValidatorResponse } from './helper'
import { ValidatorInfoEntity } from 'orm'

export async function getValidatorsReturn(): Promise<{ [operatorAddress: string]: ValidatorAnnualReturn }> {
  const rawQuery = `select operator_address,
    sum((reward - commission)/(avg_voting_power)) * 365 / count(*) as annual_return, count(*) as data_point_count from validator_return_info
    where timestamp >= DATE(now() - Interval '30 day') and avg_voting_power > 0 group by operator_address`

  const validatorReturn: {
    operator_address: string
    annual_return: string
    data_point_count: number
  }[] = await getConnection().query(rawQuery)

  if (validatorReturn.length < 1) {
    return {}
  }

  return validatorReturn.reduce((acc, returnInfo) => {
    acc[returnInfo.operator_address] = {
      stakingReturn: returnInfo.annual_return,
      isNewValidator: returnInfo.data_point_count < 15 ? true : false
    }
    return acc
  }, {})
}

export default async function getValidators(): Promise<ValidatorResponse[]> {
  const validatorsList = await getRepository(ValidatorInfoEntity).find({ chainId: config.CHAIN_ID })
  const validatorsReturns = await getValidatorsReturn()
  const validators = validatorsList.map((validator) => {
    const { operatorAddress } = validator
    return generateValidatorResponse(
      validator,
      validatorsReturns[operatorAddress] || { stakingReturn: '0', isNewValidator: true }
    )
  })

  return orderBy(validators, [(v) => Number(v.votingPower.weight)], ['desc'])
}
