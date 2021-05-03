import { plus } from 'lib/math'
import { getDashboardHistory } from './dashboardHistory'
import { DashboardEntity } from 'orm'

export default async function getTransactionVol(): Promise<TxVolumeReturn> {
  const dashboardHistory = await getDashboardHistory()

  const periodicDenomObj: DenomTxVolumeObject = {}
  const cumulativeDenomObj: DenomTxVolumeObject = {}

  dashboardHistory.forEach((item: DashboardEntity) => {
    Object.keys(item.txVolume).forEach((denom: string) => {
      if (!periodicDenomObj[denom]) {
        periodicDenomObj[denom] = [] as TxVolume[]
        cumulativeDenomObj[denom] = [] as TxVolume[]
      }
      periodicDenomObj[denom].push({
        datetime: item.timestamp.getTime(),
        txVolume: item.txVolume[denom]
      })
      const arrLength = cumulativeDenomObj[denom].length
      cumulativeDenomObj[denom].push({
        datetime: item.timestamp.getTime(),
        txVolume: plus(item.txVolume[denom], arrLength > 0 ? cumulativeDenomObj[denom][arrLength - 1].txVolume : '0')
      })
    })
  })

  const periodic = Object.keys(periodicDenomObj).map((denom: string) => ({ denom, data: periodicDenomObj[denom] }))
  const cumulative = Object.keys(cumulativeDenomObj).map((denom: string) => ({
    denom,
    data: cumulativeDenomObj[denom]
  }))

  return { periodic, cumulative }
}
