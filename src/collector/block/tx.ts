import * as Bluebird from 'bluebird'
import { EntityManager, In } from 'typeorm'
import { get, min, compact, chunk, mapValues, keyBy } from 'lodash'

import { BlockEntity, TxEntity, AccountTxEntity } from 'orm'

import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { times, minus, plus } from 'lib/math'

import { generateAccountTxs } from './accountTx'

type TaxCapAndRate = {
  taxRate: string
  taxCaps: {
    [denom: string]: string
  }
}

async function getTaxRateAndCap(height?: string): Promise<TaxCapAndRate> {
  const taxCaps: { [denom: string]: string } = mapValues(keyBy(await lcd.getTaxCaps(), 'denom'), 'tax_cap')
  const taxRate = await lcd.getTaxRate(height)

  return {
    taxRate,
    taxCaps
  }
}

export function getTax(msg, taxRate, taxCaps): Coin[] {
  if (msg.type !== 'bank/MsgSend' && msg.type !== 'bank/MsgMultiSend') {
    return []
  }

  if (msg.type === 'bank/MsgSend') {
    const amount = get(msg, 'value.amount')
    return compact(
      amount.map((item) => {
        if (item.denom === 'uluna') {
          return
        }
        const taxCap = taxCaps && taxCaps[item.denom] ? taxCaps[item.denom] : '1000000'
        return {
          denom: item.denom,
          amount: min([Math.floor(Number(times(item.amount, taxRate))), Number(taxCap)])
        }
      })
    )
  }

  if (msg.type === 'bank/MsgMultiSend') {
    const inputs = get(msg, 'value.inputs')
    const amountObj = inputs.reduce((acc, input) => {
      input.coins.reduce((accInner, coin: Coin) => {
        if (coin.denom === 'uluna') {
          return accInner
        }

        const taxCap = taxCaps && taxCaps[coin.denom] ? taxCaps[coin.denom] : '1000000'
        const tax = min([Math.floor(Number(times(coin.amount, taxRate))), taxCap])

        if (accInner[coin.denom]) {
          accInner[coin.denom] = plus(accInner[coin.denom], tax)
        } else {
          accInner[coin.denom] = tax
        }
        return accInner
      }, acc)
      return acc
    }, {})

    return Object.keys(amountObj).map((key) => {
      return {
        denom: key,
        amount: amountObj[key]
      }
    })
  }

  return []
}

function assignGasAndTax(lcdTx: Transaction.LcdTransaction, taxInfo: TaxCapAndRate) {
  if (!lcdTx.tx) return

  // get tax rate and tax caps
  const { taxRate, taxCaps } = taxInfo

  const fees = lcdTx.tx.value.fee.amount
  const feeObj = fees.reduce((acc, fee) => {
    acc[fee.denom] = fee.amount
    return acc
  }, {})

  const msgs = lcdTx.tx.value.msg
  const taxArr: string[][] = []

  // gas = fee - tax
  const gasObj = msgs.reduce((acc, msg) => {
    const msgTaxes = getTax(msg, taxRate, taxCaps)
    const taxPerMsg: string[] = []
    for (let i = 0; i < msgTaxes.length; i = i + 1) {
      const denom = msgTaxes[i].denom
      const amount = msgTaxes[i].amount

      if (feeObj[denom]) {
        feeObj[denom] = minus(feeObj[denom], amount)
      }

      if (feeObj[denom] === '0') {
        delete feeObj[denom]
      }

      taxPerMsg.push(`${amount}${denom}`)
    }
    taxArr.push(taxPerMsg)
    return acc
  }, feeObj)

  // failed tx
  if (!lcdTx.logs || lcdTx.logs.length !== taxArr.length) {
    return
  }

  // replace fee to gas
  lcdTx.tx.value.fee.amount = Object.keys(gasObj).map((denom) => {
    return {
      denom,
      amount: gasObj[denom]
    }
  })

  lcdTx.logs.forEach((log, i) => {
    log.log = {
      tax: taxArr[i].join(',')
    }
  })
}

// columbus-1 msgType -> columbus-2 msgType
function syncMsgType(tx: object): object {
  const txStr = JSON.stringify(tx)

  const replaced = txStr
    .replace(/cosmos-sdk\/MsgSend/g, 'pay/MsgSend')
    .replace(/cosmos-sdk\/MsgMultiSend/g, 'pay/MsgMultiSend')
    .replace(/cosmos-sdk\/MsgCreateValidator/g, 'staking/MsgCreateValidator')
    .replace(/cosmos-sdk\/MsgEditValidator/g, 'staking/MsgEditValidator')
    .replace(/cosmos-sdk\/MsgDelegate/g, 'staking/MsgDelegate')
    .replace(/cosmos-sdk\/MsgUndelegate/g, 'staking/MsgUndelegate')
    .replace(/cosmos-sdk\/MsgBeginRedelegate/g, 'staking/MsgBeginRedelegate')
    .replace(/cosmos-sdk\/MsgWithdrawDelegationReward/g, 'distribution/MsgWithdrawDelegationReward')
    .replace(/cosmos-sdk\/MsgWithdrawValidatorCommission/g, 'distribution/MsgWithdrawValidatorCommission')
    .replace(/cosmos-sdk\/MsgModifyWithdrawAddress/g, 'distribution/MsgModifyWithdrawAddress')
    .replace(/cosmos-sdk\/MsgUnjail/g, 'slashing/MsgUnjail')

  return JSON.parse(replaced)
}

export async function generateLcdTransactionToTxEntity(
  txhash: string,
  block: BlockEntity,
  taxInfo: TaxCapAndRate
): Promise<TxEntity> {
  // Get the tx from LCD server
  const tx = await lcd.getTx(txhash)
  let modifiedDoc: Transaction.LcdTransaction

  try {
    // JSONB에서 \u0000을 넣으려 할때 에러가 나서 처리해줌
    const txStr = JSON.stringify(tx)
    modifiedDoc = JSON.parse(txStr.replace(/\\\\\\\\u0000|\\\\u0000|\\u0000/g, ''))

    if (block.chainId === 'columbus-1') {
      modifiedDoc = syncMsgType(modifiedDoc) as Transaction.LcdTransaction
    }

    if (modifiedDoc.logs && Array.isArray(modifiedDoc.logs)) {
      modifiedDoc.logs = modifiedDoc.logs.map((item) => {
        if (item.log && typeof item.log === 'string') {
          item.log = JSON.parse(item.log)
        }

        return item
      })
    }

    assignGasAndTax(modifiedDoc, taxInfo)
  } catch (err) {
    logger.error(err)
    throw err
  }

  const txEntity = new TxEntity()
  txEntity.chainId = block.chainId
  txEntity.hash = modifiedDoc.txhash.toLowerCase()
  txEntity.data = modifiedDoc
  txEntity.timestamp = new Date(modifiedDoc.timestamp)
  txEntity.block = block
  return txEntity
}

async function generateTxEntities(txHashes: string[], block: BlockEntity): Promise<TxEntity[]> {
  // pulling all txs from hash
  const taxInfo = await getTaxRateAndCap(block.height.toString())

  // txs with the same tx hash may appear more than once in the same block duration
  const txHashesUnique = new Set(txHashes)
  return Bluebird.map([...txHashesUnique], (txHash) => generateLcdTransactionToTxEntity(txHash, block, taxInfo))
}

export async function collectTxs(mgr: EntityManager, txHashes: string[], block: BlockEntity): Promise<TxEntity[]> {
  const txEntities = await generateTxEntities(txHashes, block)

  // Skip transactions that have already been successful
  const existingTxs = await mgr.find(TxEntity, { where: { hash: In(txEntities.map((t) => t.hash.toLowerCase())) } })

  existingTxs.forEach((e) => {
    if (!e.data.code) {
      const idx = txEntities.findIndex((t) => t.hash === e.hash)

      if (idx < 0) {
        throw new Error('impossible')
      }

      logger.info(`collectTxs: existing successful tx found: ${e.hash}`)
      txEntities.splice(idx, 1)
    }
  })

  // Save TxEntity
  // NOTE: Do not use printSql, getSql, or getQuery function.
  // It breaks parameter number ordering caused by a bug from TypeORM
  const qb = mgr
    .createQueryBuilder()
    .insert()
    .into(TxEntity)
    .values(txEntities)
    .orUpdate(['timestamp', 'data', 'block_id'], ['chain_id', 'hash'])

  await qb.execute()

  // generate AccountTxEntities
  const accountTxs: AccountTxEntity[] = compact(txEntities)
    .map((txEntity) => generateAccountTxs(txEntity))
    .flat()

  // Save AccountTxEntity to the database
  // chunkify array up to 5,000 elements to avoid SQL parameter overflow
  await Bluebird.mapSeries(chunk(accountTxs, 5000), (chunk) => mgr.save(chunk))

  logger.info(`collectTxs: ${txEntities.length}, accountTxs: ${accountTxs.length}`)
  return txEntities
}
