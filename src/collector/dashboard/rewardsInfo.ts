import { EntityManager } from 'typeorm'
import { subDays } from 'date-fns'

import { RewardEntity } from 'orm'

import { convertDbTimestampToDate } from './helpers'

interface RewardsByDateReturn {
  date: string
  denom: string
  tax_sum: string
  gas_sum: string
  oracle_sum: string
  reward_sum: string
  commission_sum: string
}

export async function getRewardsSumByDateDenom(
  mgr: EntityManager,
  to: Date,
  daysBefore?: number
): Promise<RewardsByDateReturn[]> {
  const rewardQb = mgr
    .getRepository(RewardEntity)
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
    .where('datetime < :to', { to })

  if (daysBefore) {
    rewardQb.andWhere('datetime >= :from', { from: subDays(to, daysBefore) })
  }

  const rewards: RewardsByDateReturn[] = await rewardQb.getRawMany()

  return rewards
}
