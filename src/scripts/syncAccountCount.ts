import { getRepository } from 'typeorm'
import { uniq } from 'lodash'

import { init as initORM, AccountEntity, TxEntity } from 'orm'

import { bulkSave } from 'collector/helper'

const COL3 = 'columbus-3'
const COL2 = 'columbus-2'
// const SOJU = 'soju-0013'

let accountDocObj = {}

export async function increaseTxCount(address: string, txDate: Date) {
  let account

  if (!accountDocObj[address]) {
    account = await getRepository(AccountEntity).findOne({ address })
  } else {
    account = accountDocObj[address]
  }

  if (!account) {
    account = new AccountEntity()
    account.address = address
    account.createdAt = txDate
    account.txcount = 0
  }

  if (account.createdAt > txDate) {
    account.createdAt = txDate
  }

  account.txcount = account.txcount + 1
  accountDocObj[address] = account
}

export async function saveAccountTxCounter(accountTxDocs: any[]) {
  const uniqAddrs = uniq(accountTxDocs.map((accountTxDoc) => accountTxDoc.account))
  for (let i = 0; i < uniqAddrs.length; i = i + 1) {
    await increaseTxCount(uniqAddrs[i], accountTxDocs[0].timestamp)
  }
}

const updateTxsAccount = async (page: number, limit: number, start: number, end: number) => {
  console.time('tx')
  const txEntities = await getRepository(TxEntity)
    .createQueryBuilder('tx')
    .where('tx.id >= :start and tx.id <= :end', { start: start + page * limit, end: start + page * limit + limit })
    .leftJoinAndSelect('tx.accounts', 'accounts')
    .getMany()
  console.timeEnd('tx')

  let i
  let maxid = 0
  for (i = 0; i < txEntities.length; i = i + 1) {
    await saveAccountTxCounter(txEntities[i].accounts).catch((e) => {
      console.error(e)
      console.log(`sync tx: ${txEntities[i].id} failed`)
      process.exit(0)
    })
    maxid = Math.max(txEntities[i].id, maxid)
  }
  console.log(`sync tx: ${maxid} completed`)
  const accountDocs = Object.keys(accountDocObj).map((key) => accountDocObj[key])
  console.log(`docs count: ${accountDocs.length}`)
  await bulkSave(accountDocs)
}

async function start(start: number, end: number) {
  await initORM()

  const limit = 1000

  // const count = await getRepository(TxEntity)
  //   .createQueryBuilder('tx')
  //   .where("tx.id >= :start and tx.id <= :end and (tx.chain_id = :COL2 or tx.chain_id = :COL3)", { start, end, COL3, COL2 })
  //   .getCount()

  for (let i = 0; i < Math.ceil((end - start) / limit); i = i + 1) {
    await updateTxsAccount(i, limit, start, end)
    console.log(`page: ${i} completed`)
    accountDocObj = {}
  }
}

start(6767832, 12000000).catch(console.error)
