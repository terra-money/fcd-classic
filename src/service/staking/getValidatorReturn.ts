import { getConnection } from 'typeorm'
import { getAirdropAnnualAvgReturn } from 'service/dashboard'
import { plus } from 'lib/math'
import memoizeCache from 'lib/memoizeCache'

export interface ValidatorAnnualReturn {
  isNewValidator: boolean
  stakingReturn: string
}

export async function getValidatorReturnUncached(
  operatorAddress?: string
): Promise<{ [operatorAddress: string]: ValidatorAnnualReturn }> {
  const rawQuery = `
SELECT operator_address,
  SUM((reward - commission) / avg_voting_power) * 365 / COUNT(*) AS annual_return,
  COUNT(*) AS data_point_count
FROM validator_return_info
WHERE timestamp >= DATE(NOW() - INTERVAL '30 day')
${operatorAddress ? 'AND operator_address = $1' : ''}
AND avg_voting_power > 0
GROUP BY operator_address;`

  const validatorReturn: {
    operator_address: string
    annual_return: string
    data_point_count: number
  }[] = await getConnection().query(rawQuery, [operatorAddress].filter(Boolean))

  if (validatorReturn.length < 1) {
    return {}
  }

  const airdropReturn = await getAirdropAnnualAvgReturn()

  return validatorReturn.reduce((acc, returnInfo) => {
    acc[returnInfo.operator_address] = {
      stakingReturn: plus(returnInfo.annual_return, airdropReturn),
      isNewValidator: returnInfo.data_point_count < 15 ? true : false
    }
    return acc
  }, {})
}

export const getValidatorReturn = memoizeCache(getValidatorReturnUncached, {
  promise: true,
  maxAge: 600 * 1000 // 10 minutes
})
