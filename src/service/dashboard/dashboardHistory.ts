import { getRepository, MoreThanOrEqual } from 'typeorm'
import { subDays, startOfToday } from 'date-fns'

import config from 'config'
import { DashboardEntity } from 'orm'

export async function getDashboardHistory(daysBefore?: number): Promise<DashboardEntity[]> {
  const whereClause = {
    chainId: config.CHAIN_ID
  }

  if (daysBefore && !isNaN(subDays(startOfToday(), daysBefore).getTime())) {
    // resolve invalid date issue
    whereClause['timestamp'] = MoreThanOrEqual(subDays(startOfToday(), daysBefore))
  }

  const dashboards = await getRepository(DashboardEntity).find({
    where: whereClause,
    order: {
      timestamp: 'ASC'
    }
  })
  return dashboards
}
