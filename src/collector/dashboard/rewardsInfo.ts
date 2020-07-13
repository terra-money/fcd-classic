import { getRepository } from 'typeorm'
import { subDays } from 'date-fns'

import { RewardEntity } from 'orm'

import { getLatestDateOfReward, convertDbTimestampToDate } from './helpers'

interface RewardsByDateReturn {
  date: string
  denom: string
  tax_sum: string
  gas_sum: string
  oracle_sum: string
  reward_sum: string
  commission_sum: string
}

export async function getRewardsSumByDateDenom(daysBefore?: number): Promise<RewardsByDateReturn[]> {
  const latestDate = await getLatestDateOfReward()
  const rewardQb = getRepository(RewardEntity)
    .createQueryBuilder()
    .select(convertDbTimestampToDate('datetime'), 'date')
    .addSelect('denom', 'denom')
    .addSelect('SUM(tax)', 'tax_sum')
    .addSelect('SUM(gas)', 'gas_sum')
    .addSelect('SUM(oracle)', 'oracle_sum')
    .addSelect('SUM(sum)', 'reward_sum')
    .addSelect('SUM(commission)', 'commission_sum')
    .groupBy('date')
    .addGroupBy('denom')
    .orderBy('date', 'ASC')
    .where('datetime < :today', { today: latestDate })

  if (daysBefore) {
    rewardQb.andWhere('datetime >= :from', { from: subDays(latestDate, daysBefore) })
  }

  const rewards: RewardsByDateReturn[] = await rewardQb.getRawMany()

  return rewards
}
