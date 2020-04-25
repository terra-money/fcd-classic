import { get, mergeWith } from 'lodash'
import { TxEntity, NetworkEntity } from 'orm'
import { getRepository, EntityManager } from 'typeorm'

import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { plus } from 'lib/math'
import { getUSDValue, addDatetimeFilterToQuery, isSuccessfulMsg, bulkSave, getAllActivePrices } from './helper'

async function getVolumeFromSend(timestamp: number): Promise<{ [denom: string]: string }> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx')
  qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "bank/MsgSend"}]'`)
  addDatetimeFilterToQuery(timestamp, qb)
  const txs = await qb.getMany()

  const volumeByCurrency = {}

  txs.forEach((tx) => {
    const msgs = get(tx, 'data.tx.value.msg')
    const logs = get(tx, 'data.logs')

    msgs &&
      logs &&
      msgs.forEach((msg, i) => {
        if (!logs[i] || !isSuccessfulMsg(logs[i])) {
          return
        }

        const amount = get(msg, 'value.amount')
        amount &&
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

  txs.forEach((tx) => {
    const msgs = get(tx, 'data.tx.value.msg')
    const logs = get(tx, 'data.logs')

    msgs &&
      logs &&
      msgs.forEach((msg, i) => {
        if (!logs[i] || !isSuccessfulMsg(logs[i])) {
          return
        }

        const inputs = get(msg, 'value.inputs')

        inputs &&
          inputs.forEach((input) => {
            input.coins &&
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

export async function getTxVol(timestamp?: number) {
  const now = timestamp || Date.now()
  const volumeFromSendReq = getVolumeFromSend(now)
  const volumeFromMultiSendReq = getVolumeFromMultiSend(now)

  const [volumeFromSend, volumeFromMultiSend] = await Promise.all([volumeFromSendReq, volumeFromMultiSendReq])

  const volumeMerger = (obj, src) => {
    return plus(obj, src)
  }

  return mergeWith(volumeFromSend, volumeFromMultiSend, volumeMerger)
}

export async function getNetworkDocs(timestamp?: number): Promise<NetworkEntity[]> {
  const now = timestamp || Date.now()

  const [activeIssuances, activePrices, volumeObj] = await Promise.all([
    lcd.getAllActiveIssuance(),
    getAllActivePrices(now - (now % 60000) - 60000),
    getTxVol(timestamp)
  ])

  const marketCapObj = getMarketCap(activeIssuances, activePrices)

  return Object.keys(activeIssuances).map((denom) => {
    const network = new NetworkEntity()
    network.denom = denom
    network.datetime = new Date(now - (now % 60000) - 60000)
    network.supply = activeIssuances[denom]
    network.marketCap = marketCapObj[denom]
    network.txvolume = volumeObj[denom] ? volumeObj[denom] : '0'
    return network
  })
}

export async function setNetworkFromTx(now: number) {
  const docs = await getNetworkDocs(now)
  await bulkSave(docs)
}

export async function setNetwork(transactionalEntityManager: EntityManager, timestamp: number) {
  const docs = await getNetworkDocs(timestamp)
  await transactionalEntityManager.save(docs)
  logger.info(`Save network - success.`)
}
