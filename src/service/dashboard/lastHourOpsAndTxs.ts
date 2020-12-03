import { startOfHour, subHours } from 'date-fns'
import { TxEntity } from 'orm'
import { Between, getRepository, getConnection } from 'typeorm'
import { getQueryDateTime } from 'lib/time'
import memoizeCache from 'lib/memoizeCache'

async function getTxCount(startTime: string, endTime: string): Promise<number> {
  return getRepository(TxEntity).count({
    where: {
      timestamp: Between(startTime, endTime)
    }
  })
}

async function getMultiSendOpsCount(startTime: string, endTime: string): Promise<number> {
  const rawQ = `
    SELECT 
        SUM(jsonb_array_length(data->'tx'->'value'->'msg'->0->'value'->'outputs')) AS ops
    FROM 
        tx 
    WHERE 
        timestamp >= $1 
        AND timestamp <= $2 
        AND data->'tx'->'value'->'msg'@>'[{ "type": "bank/MsgMultiSend"}]'`

  const opsCount: {
    ops: number
  }[] = await getConnection().query(rawQ, [startTime, endTime])

  if (opsCount.length > 0) {
    return opsCount[0].ops
  }
  return 0
}

async function getTxAndOpsInInterval(
  startTime: string,
  endTime: string
): Promise<{ last_1h_op: number; last_1h_tx: number }> {
  const [txCount, multiSendOpsCount] = await Promise.all([
    getTxCount(startTime, endTime),
    getMultiSendOpsCount(startTime, endTime)
  ])
  return {
    last_1h_tx: txCount,
    last_1h_op: txCount + multiSendOpsCount
  }
}

const cachedTxAndOpsCount = memoizeCache(getTxAndOpsInInterval, {
  promise: true,
  maxAge: 60 * 60 * 1000 // 1 hour cache
})

export default async function lastHourOpsAndTxs(): Promise<{ last_1h_op: number; last_1h_tx: number }> {
  const hourWindow = 1
  const endTime = startOfHour(new Date())
  const startTime = subHours(endTime, hourWindow)
  return cachedTxAndOpsCount(getQueryDateTime(startTime), getQueryDateTime(endTime))
}
