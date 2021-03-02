/**
 * Implementation of Pub/Sub using SocketCluster
 */
import { getSocket } from 'socket'
import config from 'config'
import * as rp from 'request-promise'
import cache from 'lib/memoizeCache'

export async function reportLatestBlockHeight(height: string) {
  getSocket().publish('latestBlockHeight', height)
}

const getStationStatus = cache(() => rp(config.STATION_STATUS_JSON_URL), { promise: true, maxAge: 10000 })

export async function reportStationStatus() {
  const stationStatus = await getStationStatus()
  stationStatus && getSocket().publish('stationStatus', stationStatus)
}
