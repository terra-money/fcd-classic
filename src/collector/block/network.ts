import * as Bluebird from 'bluebird'
import { flattenDeep } from 'lodash'
import { TxEntity, NetworkEntity } from 'orm'
import { getRepository, EntityManager } from 'typeorm'

import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { plus } from 'lib/math'
import { getStartOfPreviousMinuteTs } from 'lib/time'
import { isSuccessfulTx } from 'lib/tx'

import { getUSDValue, addDatetimeFilterToQuery } from './helper'

function getVolumeCoins(lcdTx: Transaction.LcdTransaction, msg: Transaction.AminoMesssage): Coin[] {
  let coins: Coin[] = []

  switch (msg.type) {
    case 'bank/MsgSend': {
      coins = msg.value.amount
      break
    }
    case 'bank/MsgMultiSend': {
      coins = msg.value.inputs.map((input) => input.coins)
      break
    }
    case 'market/MsgSwapSend': {
      coins = [msg.value.offer_coin]
      break
    }
    case 'wasm/MsgInstantiateContract': {
      coins = msg.value.init_coins || msg.value.funds
      break
    }
    case 'wasm/MsgInstantiateContract2': {
      coins = msg.value.funds
      break
    }
    case 'wasm/MsgExecuteContract': {
      coins = msg.value.coins || msg.value.funds
      break
    }
    case 'msgauth/MsgExecAuthorized':
    case 'authz/MsgExec': {
      coins = flattenDeep(msg.value.msgs.map(getVolumeCoins))
      break
    }
  }

  if (!Array.isArray(coins)) {
    throw new Error(`cannot find coin field in msg: ${msg.type}, height: ${lcdTx.height}, txhash: ${lcdTx.txhash}`)
  }

  return coins
}

const txMsgs = [
  'bank/MsgSend',
  'bank/MsgMultiSend',
  'market/MsgSwapSend',
  'wasm/MsgExecuteContract',
  'wasm/MsgInstantiateContract',
  'wasm/MsgInstantiateContract2',
  'msgauth/MsgExecAuthorized',
  'authz/MsgExec'
]

async function queryTxVolume(timestamp: number): Promise<DenomMap> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx')
  const jsonbMsgTypeCondition = txMsgs.map((msg) => `@ == "${msg}"`).join(' || ')
  qb.andWhere(`data->'tx'->'value'->'msg' @? '$[*].type ? (${jsonbMsgTypeCondition})'`)
  addDatetimeFilterToQuery(timestamp, qb)
  const txs = await qb.getMany()

  return txs.reduce((volume, tx) => {
    const lcdTx = tx.data as Transaction.LcdTransaction

    if (!isSuccessfulTx(lcdTx)) {
      return volume
    }

    lcdTx.tx.value.msg.forEach((msg) => {
      const coins = getVolumeCoins(lcdTx, msg)

      coins.forEach((item) => {
        volume[item.denom] = plus(volume[item.denom], item.amount)
      })
    })

    return volume
  }, {} as DenomMap)
}

export function getMarketCap(issuances, prices): { [denom: string]: string } {
  return Object.keys(issuances).reduce((acc, denom) => {
    return { ...acc, [denom]: getUSDValue(denom, issuances[denom], prices) }
  }, {})
}

export async function collectNetwork(mgr: EntityManager, timestamp: number, strHeight: string) {
  const ts = getStartOfPreviousMinuteTs(timestamp)
  const [activeIssuances, activePrices, volumeObj] = await Promise.all([
    lcd.getAllActiveIssuance(strHeight),
    lcd.getActiveOraclePrices(strHeight),
    queryTxVolume(timestamp)
  ])

  const marketCapObj = getMarketCap(activeIssuances, activePrices)
  const datetime = new Date(ts)

  await Bluebird.map(Object.keys(activeIssuances), async (denom) => {
    // early exit
    if (!volumeObj[denom]) {
      return
    }

    const network = new NetworkEntity()

    network.denom = denom
    network.datetime = datetime
    network.supply = activeIssuances[denom]
    network.marketCap = marketCapObj[denom]
    network.txvolume = volumeObj[denom] || '0'

    const existing = await mgr.findOne(NetworkEntity, { denom, datetime })

    if (existing) {
      return mgr.update(NetworkEntity, existing.id, network)
    } else {
      return mgr.insert(NetworkEntity, network)
    }
  })

  logger.info(`collectNetwork: ${datetime}`)
}
