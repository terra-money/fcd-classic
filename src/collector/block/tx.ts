import * as Bluebird from 'bluebird'
import { EntityManager, In } from 'typeorm'
import { compact, chunk, keyBy, groupBy, flattenDeep, mapValues } from 'lodash'

import { BlockEntity, TxEntity, AccountTxEntity } from 'orm'

import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { times, minus, plus, min, getIntegerPortion } from 'lib/math'
import config from 'config'
import { generateAccountTxs } from './accountTx'
import { BOND_DENOM, BURN_TAX_UPGRADE_HEIGHT, BLOCKS_PER_WEEK } from 'lib/constant'

// Singleton class for tracking tax related parameters
class TaxPolicy {
  static exemptionList: string[]
  public static rate: string
  public static caps: {
    [denom: string]: string
  }
  public static policyCap: string
  private static cached = false

  public static async fetch(strHeight: string) {
    // These can be changed by gov
    const [treasuryParams, exemptionList] = await Promise.all([
      lcd.getTreasuryParams(strHeight),
      lcd.getTaxExemptionList(strHeight)
    ])

    TaxPolicy.policyCap = treasuryParams.tax_policy.cap.amount
    TaxPolicy.exemptionList = exemptionList

    // Tax Rate and Caps update once every week
    if (TaxPolicy.cached && +strHeight % BLOCKS_PER_WEEK !== 0) {
      return
    }

    const [rate, lcdTaxCaps] = await Promise.all([lcd.getTaxRate(strHeight), lcd.getTaxCaps(strHeight)])

    TaxPolicy.rate = rate
    TaxPolicy.caps = mapValues(keyBy(lcdTaxCaps, 'denom'), 'tax_cap')
    TaxPolicy.cached = true
  }

  public static isExemptionAddress(from: string, to: string): boolean {
    if (!from || !to) {
      throw new Error('address nil')
    }

    return TaxPolicy.exemptionList.indexOf(from) !== -1 && TaxPolicy.exemptionList.indexOf(to) !== -1
  }
}

function getTaxCoins(lcdTx: Transaction.LcdTransaction, msg: Transaction.AminoMesssage): Coin[] {
  let coins: Coin[] = []

  switch (msg.type) {
    case 'bank/MsgSend': {
      if (TaxPolicy.isExemptionAddress(msg.value.from_address, msg.value.to_address)) {
        break
      }
      coins = msg.value.amount
      break
    }
    case 'bank/MsgMultiSend': {
      const taxInputs = msg.value.inputs.filter((input, idx) => {
        const output = msg.value.outputs[idx]
        return !TaxPolicy.isExemptionAddress(input.address, output.address)
      })
      coins = flattenDeep(taxInputs.map((input) => input.coins))
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
      coins = flattenDeep(msg.value.msgs.map(getTaxCoins))
      break
    }
  }

  if (!Array.isArray(coins)) {
    throw new Error(`cannot find tax field in msg: ${msg.type}, height: ${lcdTx.height}, txhash: ${lcdTx.txhash}`)
  }

  return coins
}

export function getTax(lcdTx: Transaction.LcdTransaction, msg: Transaction.AminoMesssage): Coin[] {
  const taxCoins = getTaxCoins(lcdTx, msg)
  const groupByDenom = groupBy(taxCoins, 'denom')
  const coins = Object.keys(groupByDenom).map((denom) =>
    groupByDenom[denom].reduce((sum, coin) => ({ denom: sum.denom, amount: plus(sum.amount, coin.amount) }), {
      denom,
      amount: '0'
    })
  )

  return compact(
    coins.map((coin) => {
      // Columbus-5 no tax for Luna until burn tax upgrade
      if (coin.denom === BOND_DENOM && config.CHAIN_ID === 'columbus-5' && +lcdTx.height < BURN_TAX_UPGRADE_HEIGHT) {
        return
      }

      const cap = TaxPolicy.caps[coin.denom] || TaxPolicy.policyCap
      const tax = {
        denom: coin.denom,
        amount: min(getIntegerPortion(times(coin.amount, TaxPolicy.rate)), cap)
      }
      // if (+tax.amount > 1000000000000) console.log(`Tax: ${msg.type}, txhash: ${lcdTx.txhash}`, tax)
      return tax
    })
  )
}

function assignGasAndTax(lcdTx: Transaction.LcdTransaction) {
  // early exit
  if (lcdTx.code || !lcdTx.logs?.length) {
    return
  }

  const fees = lcdTx.tx.value.fee.amount
  const feeObj = fees.reduce((acc, fee) => {
    acc[fee.denom] = fee.amount
    return acc
  }, {})

  const msgs = lcdTx.tx.value.msg
  const taxArr: string[][] = []

  // gas = fee - tax
  const gasObj = msgs.reduce(
    (acc, msg) => {
      const msgTaxes = getTax(lcdTx, msg)
      const taxPerMsg: string[] = []
      msgTaxes.forEach(({ denom, amount }) => {
        if (acc[denom]) {
          acc[denom] = minus(acc[denom], amount)
        }

        if (acc[denom] === '0') {
          delete acc[denom]
        }

        taxPerMsg.push(`${amount}${denom}`)
      })
      taxArr.push(taxPerMsg)
      return acc
    },
    { ...feeObj }
  )

  // replace fee to gas
  lcdTx.tx.value.fee.amount = Object.keys(gasObj).map((denom) => ({
    denom,
    amount: gasObj[denom]
  }))

  if (lcdTx.logs.length !== taxArr.length) {
    throw new Error('logs and tax array length must be equal')
  }

  lcdTx.logs.forEach((log, i) => {
    if (taxArr[i].length) {
      log.log = {
        tax: taxArr[i].join(',')
      }
    }
  })
}

//Recursively iterating thru the keys of the tx object to find unicode characters that would otherwise mess up db update.
//If unicode is found in the string, then the value is base64 encoded.
//Recursion is not implemented well in js, so in case of deeply nested objects, this might fail with RangeError: Maximum call stack size exceeded
//Tx objects are hopefully not that deep, but just in case they are https://replit.com/@mkotsollaris/javascript-iterate-for-loop?v=1#index.js or something along those lines.
//Going with simple recursion due time constaints.
function sanitizeTx(tx: Transaction.LcdTransaction): Transaction.LcdTransaction {
  function hasUnicode(s) {
    // eslint-disable-next-line no-control-regex
    return /[^\u0000-\u007f]/.test(s)
  }

  const iterateTx = (obj) => {
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        iterateTx(obj[key])
      } else {
        if (hasUnicode(obj[key])) {
          const b = Buffer.from(obj[key])
          obj[key] = b.toString('base64')
        }
      }
    })
  }
  iterateTx(tx)
  return tx
}

async function generateTxEntities(txHashes: string[], block: BlockEntity): Promise<TxEntity[]> {
  await TaxPolicy.fetch(block.height.toString())

  // txs with the same tx hash may appear more than once in the same block duration
  const txHashesUnique = new Set(txHashes)

  return compact(
    await Bluebird.map(
      [...txHashesUnique],
      async (txhash) => {
        const lcdTx = await lcd.getTx(txhash)
        assignGasAndTax(lcdTx)

        const txEntity = new TxEntity()
        txEntity.chainId = block.chainId
        txEntity.hash = lcdTx.txhash.toLowerCase()
        txEntity.data = sanitizeTx(lcdTx)
        txEntity.timestamp = new Date(lcdTx.timestamp)
        txEntity.block = block
        return txEntity
      },
      { concurrency: 16 }
    )
  )
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
