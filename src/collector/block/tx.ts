import * as Bluebird from 'bluebird'
import { get, min, compact, flatten, uniq } from 'lodash'

import { BlockEntity, TxEntity, AccountEntity, AccountTxEntity } from 'orm'
import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { times, minus, plus } from 'lib/math'
import { getTaxRateAndCap } from 'lib/rpc'
import { errorReport } from 'lib/errorReporting'

import { getAccountTxDocs } from './accountTx'
import { getRepository, EntityManager } from 'typeorm'
import config from 'config'

const GET_TX_RETRY_COUNT = 10

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
          return
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

async function assignGasAndTax(height, tx): Promise<void> {
  // get tax rate and tax caps
  const { tax_rate: taxRate, tax_caps: taxCaps } = await getTaxRateAndCap(height)

  const fees = get(tx, 'tx.value.fee.amount')
  const feeObj = fees.reduce((acc, fee) => {
    acc[fee.denom] = fee.amount
    return acc
  }, {})

  const msgs = get(tx, 'tx.value.msg')
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
  if (!tx.logs || tx.logs.length !== taxArr.length) {
    return
  }

  // replace fee to gas
  tx.tx.value.fee.amount = Object.keys(gasObj).map((denom) => {
    return {
      denom,
      amount: gasObj[denom]
    }
  })

  tx.logs.forEach((log, i) => {
    if (log.log === '') {
      log.log = {
        tax: taxArr[i].join(',')
      }
    } else {
      log.log['tax'] = taxArr[i].join(',')
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

async function getTx(txhash, remRetryCnt: number): Promise<Transaction.LcdTransaction | undefined> {
  return lcd.getTx(txhash).catch(async () => {
    if (remRetryCnt >= 0) {
      await Bluebird.delay((GET_TX_RETRY_COUNT - remRetryCnt + 1) * 2000)
      logger.info(`Retry GetTx ${txhash}`)
      return getTx(txhash, remRetryCnt - 1)
    }
  })
}

export async function getTxDoc(
  chainId: string,
  block: BlockEntity,
  txhash: string,
  retryCnt: number
): Promise<TxEntity | undefined> {
  const tx = await getTx(txhash, retryCnt)
  if (!tx) {
    errorReport(new Error(`Save Tx failed. ${txhash}`))
    return
  }

  let txJson
  try {
    // JSONB에서 \u0000을 넣으려 할때 에러가 나서 처리해줌
    const txStr = JSON.stringify(tx)
    txJson = JSON.parse(txStr.replace(/\\\\\\\\u0000|\\\\u0000|\\u0000/g, ''))

    if (chainId === 'columbus-1') {
      txJson = syncMsgType(txJson)
    }

    if (txJson.logs && txJson.logs.constructor === Array) {
      txJson.logs = txJson.logs.map((item) => {
        if (item.log && item.log.constructor === String) {
          item.log = JSON.parse(item.log)
        }
        return item
      })
    }

    await assignGasAndTax(block.height, txJson)
  } catch (e) {
    logger.error(e)
    process.exit(0)
    return
  }

  const txDoc = new TxEntity()
  txDoc.chainId = chainId
  txDoc.hash = txhash
  txDoc.data = txJson
  txDoc.timestamp = txJson.timestamp
  txDoc.block = block

  return txDoc
}

async function getUpdatedTxCountAccountEntity(
  address: string,
  newTxCount: number,
  txDate: Date
): Promise<AccountEntity> {
  let account = await getRepository(AccountEntity).findOne({
    where: {
      address,
      chainId: config.CHAIN_ID
    }
  })

  if (!account) {
    logger.info(`CreateAcccount - ${address}`)
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

function getUnixqueAccountsByTx(accountTxDocs: AccountTxEntity[]): string[] {
  return uniq(accountTxDocs.map((accountTxDoc) => accountTxDoc.account))
}

interface NewTxCountTimeByAccount {
  newTxCount: number
  timestamp: Date
}

type TxCountAndTimeObject = { [accountAddress: string]: NewTxCountTimeByAccount }

function getNewTxInfoByAccount(accountTxDocsArray: AccountTxEntity[][]): TxCountAndTimeObject {
  const uniqueAccountsPerTxs: string[][] = accountTxDocsArray.map((accountTxs) => getUnixqueAccountsByTx(accountTxs))
  const accountNewTxCountObj: TxCountAndTimeObject = {}

  uniqueAccountsPerTxs.map((accountsPerTx, txIndex) => {
    accountsPerTx.map((account) => {
      if (accountNewTxCountObj[account]) {
        accountNewTxCountObj[account].newTxCount += 1
        accountNewTxCountObj[account].timestamp =
          accountNewTxCountObj[account].timestamp < accountTxDocsArray[txIndex][0].timestamp
            ? accountTxDocsArray[txIndex][0].timestamp
            : accountNewTxCountObj[account].timestamp
      } else {
        accountNewTxCountObj[account] = {
          newTxCount: 1,
          timestamp: accountTxDocsArray[txIndex][0].timestamp
        }
      }
    })
  })
  return accountNewTxCountObj
}

export async function saveTxs(
  transactionEntityManager: EntityManager,
  block: BlockEntity,
  txHashs: string[]
): Promise<void> {
  // pulling all txs from hash
  const txDocs = await Promise.all(txHashs.map((txhash) => getTxDoc(block.chainId, block, txhash, GET_TX_RETRY_COUNT)))
  // save txs
  const txEntities = await transactionEntityManager.save(txDocs)

  logger.info(`SaveTx - Height: ${block.height}, ${txEntities.length} txs saved.`)

  // get tx and account
  const accountTxDocsArray: AccountTxEntity[][] = compact(txEntities).map((txEntity) => getAccountTxDocs(txEntity))

  // get new tx by account
  const accountNewTxCountObj = getNewTxInfoByAccount(accountTxDocsArray)

  // get updated account info
  const updatedAccountEntity: AccountEntity[] = await Promise.all(
    Object.keys(accountNewTxCountObj).map((account) =>
      getUpdatedTxCountAccountEntity(
        account,
        accountNewTxCountObj[account].newTxCount,
        accountNewTxCountObj[account].timestamp
      )
    )
  )
  // save updated accounts
  await transactionEntityManager.save(updatedAccountEntity)
  logger.info(`SaveAccountTx - Height: ${block.height}, ${updatedAccountEntity.length} account updated.`)

  const accountTxEntities = await transactionEntityManager.save(flatten(accountTxDocsArray))
  logger.info(`SaveAccountTx - Height: ${block.height}, ${accountTxEntities.length} accountTxs saved.`)
}
