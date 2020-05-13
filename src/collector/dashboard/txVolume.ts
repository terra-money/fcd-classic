import { getConnection } from 'typeorm'

import { getDateFromDateTime } from './helpers'
import { getCountBaseWhereQuery } from 'service/dashboard'

interface TxVolumeByDateDenom {
  [date: string]: DenomMap
}

export async function getTxVolumeByDay(daysBefore?: number): Promise<TxVolumeByDateDenom> {
  const query = `SELECT DATE(datetime) AS date\
  , denom, SUM(txvolume) AS tx_volume FROM network\
  ${getCountBaseWhereQuery(daysBefore)} GROUP BY date, denom ORDER BY date DESC`
  const txs: {
    date: string
    denom: string
    tx_volume: string
  }[] = await getConnection().query(query)
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
