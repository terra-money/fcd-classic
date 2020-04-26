import { startOfDay, format } from 'date-fns'
import { div, plus, times } from 'lib/math'
import { getQueryDateTime } from 'lib/time'
import { dashboardRawQuery, getPriceHistory } from './helper'

export default async function getBlockRewards(daysBefore?: number): Promise<BlockRewardsReturn> {
  const today = startOfDay(Date.now())

  const sumRewardsQuery = `SELECT DATE(datetime) AS datetime,\
  denom, SUM(tax) AS sum_reward FROM reward\
  WHERE datetime < '${getQueryDateTime(today)}'
  GROUP BY datetime, denom ORDER BY datetime`

  const rewards = await dashboardRawQuery(sumRewardsQuery)

  const priceObj = await getPriceHistory()
  const getPriceObjKey = (date: Date, denom: string) => `${format(date, 'YYYY-MM-DD')}${denom}`

  // TODO: rewards array will get very large over time. calculation can be done by daily, and use that for reducing
  const rewardObj = rewards.reduce((acc, item) => {
    if (!priceObj[getPriceObjKey(item.datetime, item.denom)] && item.denom !== 'uluna' && item.denom !== 'ukrw') {
      return acc
    }

    // TODO: why are we using KRT as unit? it should be calculated on client side
    // Convert each coin value as KRT
    const reward =
      item.denom === 'ukrw'
        ? item.sum_reward
        : item.denom === 'luna'
        ? times(item.sum_reward, priceObj[getPriceObjKey(item.datetime, 'ukrw')])
        : div(
            times(item.sum_reward, priceObj[getPriceObjKey(item.datetime, 'ukrw')]),
            priceObj[getPriceObjKey(item.datetime, item.denom)]
          )

    if (acc[item.datetime]) {
      acc[item.datetime] = plus(acc[item.datetime], reward)
    } else {
      acc[item.datetime] = reward
    }
    return acc
  }, {})

  const rewardArr = Object.keys(rewardObj).map((key) => {
    return {
      datetime: new Date(key).getTime(),
      blockReward: rewardObj[key]
    }
  })

  let cum = '0'
  const sliceCnt = daysBefore ? -daysBefore : 0
  const cumArray: BlockRewardSumInfo[] = Object.keys(rewardObj)
    .reduce((acc: BlockRewardSumInfo[], key) => {
      cum = plus(cum, rewardObj[key])
      acc.push({
        datetime: new Date(key).getTime(),
        blockReward: cum
      })
      return acc
    }, [])
    .slice(sliceCnt)

  return {
    periodic: rewardArr.slice(sliceCnt),
    cumulative: cumArray
  }
}
