import { getConnection } from 'typeorm'

import { div, plus, times } from 'lib/math'
import { getQueryDateTime } from 'lib/time'
import memoizeCache from 'lib/memoizeCache'
import { getAvgPrice } from 'service/market/getAvgPrice'

export async function getTotalStakingReturnUncached(fromTs: number, toTs: number): Promise<string> {
  const toStr = getQueryDateTime(toTs)
  const fromStr = getQueryDateTime(fromTs)
  const rewardQuery = `
SELECT denom,
  SUM(sum) AS reward_sum
FROM reward
WHERE datetime >= '${fromStr}'
AND datetime < '${toStr}'
GROUP BY denom
`
  const rewards = await getConnection().query(rewardQuery)
  const avgPrice = await getAvgPrice(fromTs, toTs)

  const bondedTokensQuery = `
SELECT avg(bonded_tokens) AS avg_bonded_tokens
FROM general_info
WHERE datetime >= '${fromStr}'
  AND datetime < '${toStr}'`

  const bondedTokens = await getConnection().query(bondedTokensQuery)

  if (rewards.length === 0 || bondedTokens.length === 0) {
    return '0'
  }

  const staked = bondedTokens[0].avg_bonded_tokens
  const rewardSum = rewards.reduce((acc, reward) => {
    if (!reward.reward_sum) {
      return acc
    }

    const rewardSum = reward.denom === 'uluna' ? reward.reward_sum : div(reward.reward_sum, avgPrice[reward.denom])

    return plus(acc, rewardSum)
  }, '0')
  const netReturn = div(rewardSum, staked)
  const annualizedTimeSlot = div(365 * 24 * 3600 * 1000, toTs - fromTs)
  const annualizedReturn = times(netReturn, annualizedTimeSlot)
  return annualizedReturn
}

export const getTotalStakingReturn = memoizeCache(getTotalStakingReturnUncached, {
  promise: true,
  maxAge: 60 * 60 * 1000
})
