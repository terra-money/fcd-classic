import { EntityManager } from 'typeorm'
import { get, filter } from 'lodash'

import { TxEntity, WasmCodeEntity, WasmContractEntity } from 'orm'
import config from 'config'

import { collectorLogger as logger } from 'lib/logger'

function getTxMsgTypeAndValueMemo(tx: TxEntity): Transaction.Message & { txMemo: string } {
  const msgs: Transaction.Message[] = get(tx.data, 'tx.value.msg')
  const msg = msgs && msgs.length ? msgs[0] : { type: '', value: {} }
  return {
    ...msg,
    txMemo: get(tx.data, 'tx.value.memo')
  }
}

function getFilteredEventByType(tx: TxEntity, eventType: string): Transaction.Event | undefined {
  const logs: Transaction.Log[] = get(tx.data, 'logs')
  const events: Transaction.Event[] = filter(logs[0].events, { type: eventType })
  return events && events.length ? events[0] : undefined
}

function getContractInfo(tx: TxEntity): ContractInfo {
  const { value, txMemo } = getTxMsgTypeAndValueMemo(tx)
  const { owner, code_id, init_msg, migratable } = value

  const info = {
    owner,
    code_id,
    init_msg: Buffer.from(init_msg, 'base64').toString(),
    txhash: tx.hash,
    timestamp: tx.timestamp.toISOString(),
    txMemo,
    migratable: migratable ? migratable : false
  }

  const event = getFilteredEventByType(tx, 'instantiate_contract')

  const attributeObj = event
    ? event.attributes.reduce((acc, attr) => {
        acc[attr.key] = attr.value
        return acc
      }, {})
    : {}

  return {
    ...info,
    ...attributeObj
  } as ContractInfo
}

function getCodeInfo(tx: TxEntity): WasmCodeInfo {
  const { value, txMemo } = getTxMsgTypeAndValueMemo(tx)
  const sender = value ? get(value, 'value.sender') : ''
  const info = {
    txhash: tx.hash,
    timestamp: tx.timestamp.toISOString(),
    sender,
    txMemo
  }
  const event = getFilteredEventByType(tx, 'store_code')
  const attributeObj = event
    ? event.attributes.reduce((acc, attr) => {
        acc[attr.key] = attr.value
        return acc
      }, {})
    : {}

  return {
    ...info,
    ...attributeObj
  } as WasmCodeInfo
}

function generateWasmCodeEntity(tx: TxEntity): WasmCodeEntity {
  const info = getCodeInfo(tx)

  const code = new WasmCodeEntity()

  code.chainId = config.CHAIN_ID
  code.sender = info.sender
  code.codeId = info.code_id
  code.txHash = info.txhash
  code.timestamp = tx.timestamp
  code.txMemo = info.txMemo

  return code
}

function generateWasmContractEntity(tx: TxEntity): WasmContractEntity {
  const info = getContractInfo(tx)

  const contract = new WasmContractEntity()

  contract.chainId = config.CHAIN_ID
  contract.codeId = info.code_id
  contract.contractAddress = info.contract_address
  contract.initMsg = info.init_msg
  contract.owner = info.owner
  contract.timestamp = tx.timestamp
  contract.txHash = info.txhash
  contract.txMemo = info.txMemo
  contract.migratable = info.migratable
  return contract
}

function getMsgTypeAndStatus(
  tx: TxEntity
): {
  msgType: string
  failed: boolean
} {
  const ret = {
    msgType: '',
    failed: false
  }

  // get msg type
  const msgs: Transaction.Message[] = get(tx.data, 'tx.value.msg')
  ret.msgType = msgs && msgs.length ? get(msgs[0], 'type') : ''

  if (ret.msgType === '') {
    ret.failed = true
  }

  const logs: Transaction.Log[] = get(tx.data, 'logs')
  if (!logs || logs.length === 0) {
    ret.failed = true
  }

  const code = get(tx.data, 'code')
  if (code) {
    ret.failed = true
  }

  return ret
}

async function migrateContract(transactionEntityManager: EntityManager, wasmMigrationTxs: TxEntity[]) {
  for (const tx of wasmMigrationTxs) {
    const { value } = getTxMsgTypeAndValueMemo(tx)
    const { owner, contract, migrate_msg, new_code_id } = value

    const existingContract = await transactionEntityManager.findOne(WasmContractEntity, {
      owner,
      contractAddress: contract
    })

    if (!existingContract) {
      throw new Error('Failed to update contract')
    }

    transactionEntityManager.update(WasmContractEntity, existingContract.id, {
      migrateMsg: Buffer.from(migrate_msg, 'base64').toString(),
      codeId: new_code_id
    })
  }
  return
}

export async function saveWasmCodeAndContract(transactionEntityManager: EntityManager, txEntities: TxEntity[]) {
  const wasmCodes: WasmCodeEntity[] = []
  const wasmContracts: WasmContractEntity[] = []
  const wasmTxToMigrate: TxEntity[] = []

  txEntities.forEach((tx: TxEntity) => {
    const { msgType, failed } = getMsgTypeAndStatus(tx)
    if (failed) {
      return
    }

    switch (msgType) {
      case `wasm/MsgStoreCode`:
        wasmCodes.push(generateWasmCodeEntity(tx))
        break
      case 'wasm/MsgInstantiateContract':
        wasmContracts.push(generateWasmContractEntity(tx))
        break
      case 'wasm/MsgMigrateContract':
        wasmTxToMigrate.push(tx)
        break
      default:
        break
    }
  })

  logger.info(`Storing ${wasmCodes.length} codes and ${wasmContracts.length} contracts.`)
  await transactionEntityManager.save(wasmCodes)
  await transactionEntityManager.save(wasmContracts)
  logger.info(`Stored ${wasmCodes.length} codes and ${wasmContracts.length} contracts.`)

  logger.info(`Migrating ${wasmTxToMigrate.length} contract`)
  await migrateContract(transactionEntityManager, wasmTxToMigrate)
  logger.info(`Migrated ${wasmTxToMigrate.length} contract`)
}
