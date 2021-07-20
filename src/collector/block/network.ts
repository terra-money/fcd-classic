import * as Bluebird from 'bluebird'
import { get, mergeWith } from 'lodash'
import { TxEntity, NetworkEntity } from 'orm'
import { getRepository, EntityManager } from 'typeorm'

import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { plus } from 'lib/math'
import { getStartOfPreviousMinuteTs } from 'lib/time'
import { isSuccessfulTx } from 'lib/tx'

import { getUSDValue, addDatetimeFilterToQuery, getAllActivePrices } from './helper'

async function getVolumeFromSend(timestamp: number): Promise<{ [denom: string]: string }> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx')
  qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "bank/MsgSend"}]'`)
  addDatetimeFilterToQuery(timestamp, qb)
  const txs = await qb.getMany()

  const volumeByCurrency = {}

  txs.forEach((tx: TxEntity) => {
    const lcdTx = tx.data as Transaction.LcdTransaction
    const msgs = lcdTx.tx.value.msg
    const logs = lcdTx.logs

    isSuccessfulTx(lcdTx) &&
      msgs &&
      logs &&
      msgs.forEach((msg, i) => {
        if (!logs[i]) {
          return
        }

        const amount = get(msg, 'value.amount')
        const msgType = get(msg, 'type')
        if (msgType !== 'bank/MsgSend') {
          // we only need to check send msg
          return
        }
        Array.isArray(amount) &&
          amount.forEach((item) => {
            volumeByCurrency[item.denom] = volumeByCurrency[item.denom]
              ? plus(volumeByCurrency[item.denom], item.amount)
              : item.amount
          })
      })
  })
  return volumeByCurrency
}

async function getVolumeFromMultiSend(timestamp: number): Promise<{ [denom: string]: string }> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx')
  qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "bank/MsgMultiSend"}]'`)
  addDatetimeFilterToQuery(timestamp, qb)
  const txs = await qb.getMany()

  const volumeByCurrency = {}

  txs.forEach((tx: TxEntity) => {
    const lcdTx = tx.data as Transaction.LcdTransaction
    const msgs = lcdTx.tx.value.msg
    const logs = lcdTx.logs

    isSuccessfulTx(lcdTx) &&
      msgs &&
      logs &&
      msgs.forEach((msg, i) => {
        if (!logs[i]) {
          return
        }

        const inputs = get(msg, 'value.inputs')
        const msgType = get(msg, 'type')
        if (msgType !== 'bank/MsgMultiSend') {
          // only need to check bank MsgMultiSend
          return
        }
        Array.isArray(inputs) &&
          inputs.forEach((input) => {
            Array.isArray(input.coins) &&
              input.coins.forEach((coin) => {
                volumeByCurrency[coin.denom] = volumeByCurrency[coin.denom]
                  ? plus(volumeByCurrency[coin.denom], coin.amount)
                  : coin.amount
              })
          })
      })
  })

  return volumeByCurrency
}

export function getMarketCap(issuances, prices): { [denom: string]: string } {
  return Object.keys(issuances).reduce((acc, denom) => {
    return { ...acc, [denom]: getUSDValue(denom, issuances[denom], prices) }
  }, {})
}

export async function getTxVol(timestamp: number) {
  const volumeFromSendReq = getVolumeFromSend(timestamp)
  const volumeFromMultiSendReq = getVolumeFromMultiSend(timestamp)

  const [volumeFromSend, volumeFromMultiSend] = await Promise.all([volumeFromSendReq, volumeFromMultiSendReq])

  return mergeWith(volumeFromSend, volumeFromMultiSend, plus)
}

export async function collectNetwork(mgr: EntityManager, timestamp: number, strHeight: string) {
  const ts = getStartOfPreviousMinuteTs(timestamp)
  const [activeIssuances, activePrices, volumeObj] = await Promise.all([
    lcd.getAllActiveIssuance(strHeight),
    getAllActivePrices(ts),
    getTxVol(timestamp)
  ])

  const marketCapObj = getMarketCap(activeIssuances, activePrices)
  const datetime = new Date(ts)

  await Bluebird.map(Object.keys(activeIssuances), async (denom) => {
    const network = new NetworkEntity()

    network.denom = denom
    network.datetime = datetime
    network.supply = activeIssuances[denom]
    network.marketCap = marketCapObj[denom]
    network.txvolume = volumeObj[denom] ? volumeObj[denom] : '0'

    const existing = await mgr.findOne(NetworkEntity, { denom, datetime })

    if (existing) {
      return mgr.update(NetworkEntity, existing.id, network)
    } else {
      return mgr.insert(NetworkEntity, network)
    }
  })

  logger.info(`collectNetwork: ${datetime}`)
}
