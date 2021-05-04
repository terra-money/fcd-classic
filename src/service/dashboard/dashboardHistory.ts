import { getRepository } from 'typeorm'
import { DashboardEntity } from 'orm'
import memoizeCache from 'lib/memoizeCache'

async function getDashboardHistoryUncached(): Promise<DashboardEntity[]> {
  const dashboards = await getRepository(DashboardEntity).find({
    order: {
      timestamp: 'ASC'
    }
  })
  return dashboards
}

export const getDashboardHistory = memoizeCache(getDashboardHistoryUncached, {
  promise: true,
  maxAge: 60 * 60 * 1000, // 1 hour cache
  preFetch: 0.75 // fetch again after 45 mins
})
