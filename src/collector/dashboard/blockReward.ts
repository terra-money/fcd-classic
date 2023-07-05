import { EntityManager } from 'typeorm'
import { times, div, plus, getIntegerPortion } from 'lib/math'
import { getPriceHistory } from 'service/dashboard'
import { getPriceObjKey } from './helpers'
import { getRewardsSumByDateDenom } from './rewardsInfo'
import { BOND_DENOM } from 'lib/constant'

// key: date in format yyyy-MM-dd
// value: big int string format
interface RewardByDateMap {
  [date: string]: string
}

export async function getBlockRewardsByDay(
  mgr: EntityManager,
  to: Date,
  daysBefore?: number
): Promise<RewardByDateMap> {
  const rewards = await getRewardsSumByDateDenom(mgr, to, daysBefore)

  const priceObj = await getPriceHistory(mgr, to, daysBefore)

  // TODO: rewards array will get very large over time. calculation can be done by daily, and use that for reducing
  const rewardObj = rewards.reduce((acc, item) => {
    const price = priceObj[getPriceObjKey(item.date, item.denom)]

    if (!price && item.denom !== BOND_DENOM && item.denom !== 'ukrw') {
      return acc
    }

    const ukrwPrice = priceObj[getPriceObjKey(item.date, 'ukrw')]
    // TODO: why are we using KRT as unit? it should be calculated on client side
    // Convert each coin value as KRT
    const reward =
      item.denom === 'ukrw'
        ? item.tax_sum
        : item.denom === BOND_DENOM
        ? times(item.tax_sum, ukrwPrice)
        : div(times(item.tax_sum, ukrwPrice), price)

    acc[item.date] = plus(acc[item.date], reward)
    return acc
  }, {} as RewardByDateMap)

  for (const [date, tokens] of Object.entries(rewardObj)) {
    rewardObj[date] = getIntegerPortion(tokens)
  }

  return rewardObj
}
