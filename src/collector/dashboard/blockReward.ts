import { startOfDay, format } from 'date-fns'
import { getConnection } from 'typeorm'

import { times, div, plus } from 'lib/math'
import { getPriceHistory, getCountBaseWhereQuery } from 'service/dashboard'

// key: date in format YYYY-MM-DD
// value: big int string format
interface RewardByDateMap {
  [date: string]: string
}

export async function getBlockRewardsByDay(daysBefore?: number): Promise<RewardByDateMap> {
  const today = startOfDay(Date.now())

  const sumRewardsQuery = `SELECT DATE(datetime) AS date, \
denom, SUM(tax) AS sum_reward FROM reward \
${getCountBaseWhereQuery(daysBefore)} \
GROUP BY date, denom ORDER BY date`

  const rewards: {
    date: Date
    denom: string
    sum_reward: string
  }[] = await getConnection().query(sumRewardsQuery)

  const priceObj = await getPriceHistory(daysBefore)

  const getPriceObjKey = (date: Date, denom: string) => `${format(date, 'YYYY-MM-DD')}${denom}`

  // TODO: rewards array will get very large over time. calculation can be done by daily, and use that for reducing
  const rewardObj: RewardByDateMap = rewards.reduce((acc, item) => {
    if (!priceObj[getPriceObjKey(item.date, item.denom)] && item.denom !== 'uluna' && item.denom !== 'ukrw') {
      return acc
    }

    // TODO: why are we using KRT as unit? it should be calculated on client side
    // Convert each coin value as KRT
    const reward =
      item.denom === 'ukrw'
        ? item.sum_reward
        : item.denom === 'luna'
        ? times(item.sum_reward, priceObj[getPriceObjKey(item.date, 'ukrw')])
        : div(
            times(item.sum_reward, priceObj[getPriceObjKey(item.date, 'ukrw')]),
            priceObj[getPriceObjKey(item.date, item.denom)]
          )

    const key = format(item.date, 'YYYY-MM-DD')

    if (acc[key]) {
      acc[key] = plus(acc[key], reward)
    } else {
      acc[key] = reward
    }
    return acc
  }, {} as RewardByDateMap)

  return rewardObj
}
