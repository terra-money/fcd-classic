import { getConnection } from 'typeorm'

import { getCountBaseWhereQuery } from 'service/dashboard'

interface TxVolumeByDateDenom {
  [date: string]: DenomMap
}

export async function getTxVolumeByDay(daysBefore?: number) {
  const query = `SELECT DATE(datetime) AS date\
  , denom, SUM(txvolume) AS txVolume FROM network\
  ${getCountBaseWhereQuery(daysBefore)} GROUP BY date, denom ORDER BY date DESC`
  const txs: {
    date: string
    denom: string
    txVolume: string
  }[] = await getConnection().query(query)

  const txVolObj: TxVolumeByDateDenom = txs.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = {}
    }
    acc[item.date][item.denom] = item.txVolume
    return acc
  }, {} as TxVolumeByDateDenom)
  return txVolObj
}
