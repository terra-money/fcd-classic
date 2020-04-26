import { dashboardRawQuery } from './helper'
import { denomObjectToArray, sortDenoms } from 'lib/common'
import { plus } from 'lib/math'
import { startOfDay } from 'date-fns'
import { getQueryDateTime } from 'lib/time'

export default async function getTransactionVol(count = 0): Promise<TxVolumeReturn> {
  const today = startOfDay(Date.now())
  const query = `select date(datetime) as date\
  , denom, sum(txvolume) as tx_volume from network\
  where datetime < '${getQueryDateTime(today)}' group by 1, 2 order by 1 desc`
  const txs = await dashboardRawQuery(query)

  const txVolObj: DenomObject = txs.reduce((acc, item) => {
    if (!acc[item.denom]) {
      acc[item.denom] = [
        {
          datetime: new Date(item.date).getTime(),
          txVolume: item.tx_volume
        }
      ]
      return acc
    }
    acc[item.denom].unshift({
      datetime: new Date(item.date).getTime(),
      txVolume: item.tx_volume
    })
    return acc
  }, {})

  const sliceCnt = -count
  const periodic: DenomTxVolume[] = denomObjectToArray(txVolObj, sliceCnt)
  const cumulative: DenomTxVolume[] = sortDenoms(
    Object.keys(txVolObj).map((denom) => {
      const txVolumes = txVolObj[denom]

      let cum = '0'
      return {
        denom,
        data: txVolumes
          .reduce((acc, item) => {
            cum = plus(cum, item.txVolume)
            acc.push({
              datetime: item.datetime,
              txVolume: cum
            })
            return acc
          }, [] as TxVolume[])
          .slice(sliceCnt)
      }
    })
  )

  return { periodic, cumulative }
}
