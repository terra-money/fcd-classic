import { getConnection } from 'typeorm'

export async function getValidatorAnnualAvgReturn(operatorAddress: string): Promise<ValidatorAnnualReturn> {
  const rawQuery = `
SELECT operator_address,
  SUM((reward - commission) / (avg_voting_power)) * 365 / COUNT(*) AS annual_return,
  COUNT(*) AS data_point_count
FROM validator_return_info
WHERE TIMESTAMP >= DATE(NOW() - INTERVAL '30 day')
AND operator_address = '$1'
AND avg_voting_power > 0
GROUP BY operator_address;`

  const validatorReturn = await getConnection().query(rawQuery, [operatorAddress])

  if (validatorReturn.length < 1) {
    return {
      stakingReturn: '0',
      isNewValidator: true
    }
  }

  return {
    stakingReturn: validatorReturn[0].annual_return,
    isNewValidator: validatorReturn[0].data_point_count > 15 ? false : true
  }
}
