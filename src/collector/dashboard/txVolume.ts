import { EntityManager } from 'typeorm'
import { subDays } from 'date-fns'
import BigNumber from 'bignumber.js'
import { NetworkEntity } from 'orm'
import { convertDbTimestampToDate } from './helpers'
import { getIntegerPortion } from 'lib/math'

interface TxVolumeByDateDenom {
  [date: string]: DenomMap
}

export async function getTxVolumeByDay(
  mgr: EntityManager,
  to: Date,
  daysBefore?: number
): Promise<TxVolumeByDateDenom> {
  const queryBuilder = mgr
    .getRepository(NetworkEntity)
    .createQueryBuilder()
    .select(convertDbTimestampToDate('datetime'), 'date')
    .addSelect('denom', 'denom')
    .addSelect('SUM(txvolume)', 'tx_volume')
    .where('datetime < :to', { to })
    .groupBy('date')
    .addGroupBy('denom')
    .orderBy('date', 'ASC')

  if (daysBefore) {
    queryBuilder.andWhere('datetime >= :from', { from: subDays(to, daysBefore) })
  }

  const txs: {
    date: string
    denom: string
    tx_volume: string
  }[] = await queryBuilder.getRawMany()
  const txVolObj = txs
    .filter((tx) => new BigNumber(tx.tx_volume).isGreaterThan(0))
    .reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = {}
      }
      acc[item.date][item.denom] = getIntegerPortion(item.tx_volume)
      return acc
    }, {} as TxVolumeByDateDenom)

  return txVolObj
}
