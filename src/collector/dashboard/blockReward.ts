import { getRepository } from 'typeorm'
import { startOfToday, subDays } from 'date-fns'

import { times, div, plus } from 'lib/math'
import { getDateFromDateTime } from 'lib/time'

import { getPriceHistory } from 'service/dashboard'
import { getPriceObjKey, convertDbTimestampToDate } from './helpers'
import { RewardEntity } from 'orm'

// key: date in format YYYY-MM-DD
// value: big int string format
interface RewardByDateMap {
  [date: string]: string
}

export async function getBlockRewardsByDay(daysBefore?: number): Promise<RewardByDateMap> {
  const queryBuilder = getRepository(RewardEntity)
    .createQueryBuilder()
    .select(convertDbTimestampToDate('datetime'), 'date')
    .addSelect('denom', 'denom')
    .addSelect('SUM(tax)', 'sum_reward')
    .groupBy('date')
    .addGroupBy('denom')
    .orderBy('date', 'ASC')
    .where('datetime < :today', { today: startOfToday() })

  if (daysBefore) {
    queryBuilder.where('datetime >= :from', { from: subDays(startOfToday(), daysBefore) })
  }

  const rewards: {
    date: Date
    denom: string
    sum_reward: string
  }[] = await queryBuilder.getRawMany()

  const priceObj = await getPriceHistory(daysBefore)

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

    const key = getDateFromDateTime(item.date)

    if (acc[key]) {
      acc[key] = plus(acc[key], reward)
    } else {
      acc[key] = reward
    }
    return acc
  }, {} as RewardByDateMap)

  return rewardObj
}
