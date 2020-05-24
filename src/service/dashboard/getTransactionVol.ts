import { plus } from 'lib/math'
import { getDashboardHistory } from './dashboardHistory'
import { DashboardEntity } from 'orm'

export default async function getTransactionVol(count = 0): Promise<TxVolumeReturn> {
  const dashboardHistory = await getDashboardHistory(count)

  const periodicDenomObj: DenomTxVolumeObject = {}
  const cummulativeDenomObj: DenomTxVolumeObject = {}

  dashboardHistory.forEach((item: DashboardEntity) => {
    Object.keys(item.txVolume).forEach((denom: string) => {
      if (!periodicDenomObj[denom]) {
        periodicDenomObj[denom] = [] as TxVolume[]
        cummulativeDenomObj[denom] = [] as TxVolume[]
      }
      periodicDenomObj[denom].push({
        datetime: item.timestamp.getTime(),
        txVolume: item.txVolume[denom]
      })
      const arrLenght = cummulativeDenomObj[denom].length
      cummulativeDenomObj[denom].push({
        datetime: item.timestamp.getTime(),
        txVolume: plus(item.txVolume[denom], arrLenght > 0 ? cummulativeDenomObj[denom][arrLenght - 1].txVolume : '0')
      })
    })
  })

  const periodic = Object.keys(periodicDenomObj).map((denom: string) => ({ denom, data: periodicDenomObj[denom] }))
  const cumulative = Object.keys(cummulativeDenomObj).map((denom: string) => ({
    denom,
    data: cummulativeDenomObj[denom]
  }))

  return { periodic, cumulative }
}
