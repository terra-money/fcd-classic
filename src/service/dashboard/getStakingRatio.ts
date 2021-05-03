import { getRepository } from 'typeorm'
import { orderBy } from 'lodash'
import { GeneralInfoEntity } from 'orm'

/**
 * Staking ratio on specific date
 */
interface StakingRatioInfo {
  datetime: number // unix timestamp
  stakingRatio: number // float number
}

/**
 *
 * @param count number of previous days from today for staking ratio history
 */
export default async function getStakingRatio(): Promise<StakingRatioInfo[]> {
  const qb = getRepository(GeneralInfoEntity)
    .createQueryBuilder()
    .addSelect('DATE(datetime)', 'date')
    .addSelect('staking_ratio')
    .andWhere('staking_ratio IS NOT NULL')
    .distinctOn(['date'])
    .orderBy('date', 'ASC')

  const result = await qb.getMany()

  return orderBy(result, ['datetime'], ['desc']).map((item) => ({
    datetime: item.datetime.getTime(),
    stakingRatio: item.stakingRatio
  }))
}
