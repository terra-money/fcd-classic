import * as Bluebird from 'bluebird'
import { getRepository, EntityManager } from 'typeorm'
import { get, min, compact, uniq, mapValues, keyBy } from 'lodash'

import { BlockEntity, TxEntity, AccountEntity, AccountTxEntity } from 'orm'
import config from 'config'

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

export async function getLcdTx(
  chainId: string,
  txhash: string,
  taxInfo: TaxCapAndRate
): Promise<Transaction.LcdTransaction | undefined> {
  const tx = await lcd.getTx(txhash)

  if (!tx) {
    return
  }

  let modifiedDoc
  try {
    // JSONB에서 \u0000을 넣으려 할때 에러가 나서 처리해줌
    const txStr = JSON.stringify(tx)
    modifiedDoc = JSON.parse(txStr.replace(/\\\\\\\\u0000|\\\\u0000|\\u0000/g, ''))

    if (chainId === 'columbus-1') {
      modifiedDoc = syncMsgType(modifiedDoc)
    }

    if (modifiedDoc.logs && Array.isArray(modifiedDoc.logs)) {
      modifiedDoc.logs = modifiedDoc.logs.map((item) => {
        if (item.log && item.log instanceof String) {
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

  return modifiedDoc
}

export async function generateTxEntities(txHashes: string[], height: string, block: BlockEntity): Promise<TxEntity[]> {
  // pulling all txs from hash
  const taxInfo = await getTaxRateAndCap(height)

  const lcdTxs = await Bluebird.map(txHashes, (txHash) => getLcdTx(config.CHAIN_ID, txHash, taxInfo))

  // If we use node cluster, this can be occured.
  if (lcdTxs.length !== lcdTxs.filter(Boolean).length) {
    throw new Error('transaction not found on node')
  }

  return lcdTxs.map((txDoc) => {
    const txEntity = new TxEntity()
    txEntity.chainId = config.CHAIN_ID

    if (txDoc) {
      txEntity.hash = txDoc.txhash.toLowerCase()
      txEntity.data = txDoc
      txEntity.timestamp = new Date(txDoc.timestamp)
      txEntity.block = block
    }

    return txEntity
  })
}

async function getUpdatedTxCountAccountEntity(
  address: string,
  newTxCount: number,
  txDate: Date
): Promise<AccountEntity> {
  let account = await getRepository(AccountEntity).findOne({ address })

  if (!account) {
    account = new AccountEntity()
    account.address = address
    account.createdAt = txDate
    account.txcount = 0
  }

  // TODO: Change to updated at
  if (account.createdAt > txDate) {
    account.createdAt = txDate
  }

  account.txcount = account.txcount + newTxCount
  return account
}

function getUniqueAccountsByTx(accountTxDocs: AccountTxEntity[]): string[] {
  return uniq(accountTxDocs.map((d) => d.account))
}

interface NewTxInfo {
  [accountAddress: string]: {
    newTxCount: number
    timestamp: Date
  }
}

function extractNewTxInfo(accountTxDocsArray: AccountTxEntity[][]): NewTxInfo {
  const uniqueAccountsPerTxs: string[][] = accountTxDocsArray.map((accountTxs) => getUniqueAccountsByTx(accountTxs))
  const newTxInfo: NewTxInfo = {}

  uniqueAccountsPerTxs.map((accountsPerTx, txIndex) => {
    accountsPerTx.map((account) => {
      if (newTxInfo[account]) {
        newTxInfo[account].newTxCount += 1
        newTxInfo[account].timestamp =
          newTxInfo[account].timestamp < accountTxDocsArray[txIndex][0].timestamp
            ? accountTxDocsArray[txIndex][0].timestamp
            : newTxInfo[account].timestamp
      } else {
        newTxInfo[account] = {
          newTxCount: 1,
          timestamp: accountTxDocsArray[txIndex][0].timestamp
        }
      }
    })
  })

  return newTxInfo
}

export async function collectTxs(mgr: EntityManager, txEntities: TxEntity[], block: BlockEntity): Promise<void> {
  // Save TxEntity
  // NOTE: Do not use printSql, getSql, or getQuery function.
  // It breaks parameter number ordering caused by a bug from TypeORM
  const qb = mgr
    .createQueryBuilder()
    .insert()
    .into(TxEntity)
    .values(txEntities)
    .orUpdate({ conflict_target: ['chain_id', 'hash'], overwrite: ['timestamp', 'data', 'block_id'] })

  await qb.execute()

  // generate AccountTxEntities
  const accountTxs: AccountTxEntity[][] = compact(txEntities).map((txEntity) => generateAccountTxs(txEntity))

  // Extract new tx acount and latest timestamp by address and,
  const newTxInfo = extractNewTxInfo(accountTxs)

  // Find or create AccountEntity and assign it and,
  const updatedAccountEntity: AccountEntity[] = await Promise.all(
    Object.keys(newTxInfo).map((account) =>
      getUpdatedTxCountAccountEntity(account, newTxInfo[account].newTxCount, newTxInfo[account].timestamp)
    )
  )

  // Save AccountEntity to the database
  await mgr.save(updatedAccountEntity)

  // Save AccountTxEntity to the database
  const accountTxEntities = await mgr.save(accountTxs.flat())

  logger.info(
    `SaveTxs - height: ${block.height}, txs: ${txEntities.length}, ` +
      `account: ${updatedAccountEntity.length}, accountTxs: ${accountTxEntities.length}`
  )
}
