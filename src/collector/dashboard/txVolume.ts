import { getRepository } from 'typeorm'
import { startOfToday, subDays } from 'date-fns'

import { getDateFromDateTime, convertDbTimestampToDate } from './helpers'
import { NetworkEntity } from 'orm'

interface TxVolumeByDateDenom {
  [date: string]: DenomMap
}

export async function getTxVolumeByDay(daysBefore?: number): Promise<TxVolumeByDateDenom> {
  const queryBuilder = getRepository(NetworkEntity)
    .createQueryBuilder()
    .select(convertDbTimestampToDate('datetime'), 'date')
    .addSelect('denom', 'denom')
    .addSelect('SUM(txvolume)', 'tx_volume')
    .where('datetime < :today', { today: startOfToday() })
    .groupBy('date')
    .addGroupBy('denom')
    .orderBy('date', 'DESC')

  if (daysBefore) {
    queryBuilder.andWhere('datetime >= :from', { from: subDays(startOfToday(), daysBefore) })
  }

  const txs: {
    date: string
    denom: string
    tx_volume: string
  }[] = await queryBuilder.getRawMany()

  const txVolObj: TxVolumeByDateDenom = txs.reduce((acc, item) => {
    const dateKey = getDateFromDateTime(new Date(item.date))
    if (!acc[dateKey]) {
      acc[dateKey] = {}
    }
    acc[dateKey][item.denom] = item.tx_volume
    return acc
  }, {} as TxVolumeByDateDenom)
  return txVolObj
}
