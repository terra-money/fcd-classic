import { times, div, plus } from 'lib/math'
import { getDateFromDateTime } from 'lib/time'

import { getPriceHistory } from 'service/dashboard'
import { getPriceObjKey } from './helpers'
import { getRewardsSumByDateDenom } from './rewardsInfo'
import { BOND_DENOM } from 'lib/constant'

// key: date in format yyyy-MM-dd
// value: big int string format
interface RewardByDateMap {
  [date: string]: string
}

export async function getBlockRewardsByDay(daysBefore?: number): Promise<RewardByDateMap> {
  const rewards = await getRewardsSumByDateDenom(daysBefore)

  const priceObj = await getPriceHistory(daysBefore)

  // TODO: rewards array will get very large over time. calculation can be done by daily, and use that for reducing
  const rewardObj: RewardByDateMap = rewards.reduce((acc, item) => {
    if (!priceObj[getPriceObjKey(item.date, item.denom)] && item.denom !== BOND_DENOM && item.denom !== 'ukrw') {
      return acc
    }

    // TODO: why are we using KRT as unit? it should be calculated on client side
    // Convert each coin value as KRT
    const reward =
      item.denom === 'ukrw'
        ? item.tax_sum
        : item.denom === BOND_DENOM
        ? times(item.tax_sum, priceObj[getPriceObjKey(item.date, 'ukrw')])
        : div(
            times(item.tax_sum, priceObj[getPriceObjKey(item.date, 'ukrw')]),
            priceObj[getPriceObjKey(item.date, item.denom)]
          )

    const key = getDateFromDateTime(new Date(item.date))

    if (acc[key]) {
      acc[key] = plus(acc[key], reward)
    } else {
      acc[key] = reward
    }
    return acc
  }, {} as RewardByDateMap)

  return rewardObj
}
