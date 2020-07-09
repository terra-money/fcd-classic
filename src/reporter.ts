/**
 * Implementation of Pub/Sub using SocketCluster
 */
import { getSocket } from 'socket'
import config from 'config'

import { apiLogger as logger } from 'lib/logger'
import { get } from 'lodash'
import * as lcd from 'lib/lcd'
import * as rp from 'request-promise'

let reportTimer: NodeJS.Timer

async function getLatestBlockHeight() {
  const latestBlock = await lcd.getLatestBlock()
  return get(latestBlock, 'block.header.height')
}

async function reportLatestBlockHeight() {
  const latestBlockHeight = await getLatestBlockHeight()
  latestBlockHeight && getSocket().publish('latestBlockHeight', latestBlockHeight)
}

async function getStationStatus() {
  return rp(config.STATION_STATUS_JSON_URL)
}

async function reportStationStatus() {
  const stationStatus = await getStationStatus()
  stationStatus && getSocket().publish('stationStatus', stationStatus)
}

export default async function reportTicker() {
  try {
    await reportLatestBlockHeight()
    await reportStationStatus()
  } catch (err) {
    logger.error(err)
  }

  reportTimer && clearTimeout(reportTimer)
  reportTimer = setTimeout(() => reportTicker(), config.HEIGHT_REPORT_INTERVAL)
}
