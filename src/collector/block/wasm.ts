import { EntityManager } from 'typeorm'
import { get, filter } from 'lodash'

import { TxEntity, WasmCodeEntity, WasmContractEntity } from 'orm'
import config from 'config'

import { collectorLogger as logger } from 'lib/logger'

function getContractInfo(tx: TxEntity): ContractInfo {
  const msgs: Transaction.Message[] = get(tx.data, 'tx.value.msg')
  const msg: Transaction.Message[] = filter(msgs, { type: 'wasm/InstantiateContract' })
  const valueObj = msg && msg.length ? get(msg[0], 'value') : {}
  const { owner, code_id, init_msg } = valueObj
  const txMemo = get(tx.data, 'tx.value.memo')

  const info = {
    owner,
    code_id,
    init_msg: Buffer.from(init_msg, 'base64').toString(),
    txhash: tx.hash,
    timestamp: tx.timestamp.toISOString(),
    txMemo
  }

  const logs: Transaction.Log[] = get(tx.data, 'logs')

  const events: Transaction.Event[] = filter(logs[0].events, { type: 'instantiate_contract' })

  const attributeObj = events[0].attributes.reduce((acc, attr) => {
    acc[attr.key] = attr.value
    return acc
  }, {})

  return {
    ...info,
    ...attributeObj
  } as ContractInfo
}

function getCodeInfo(tx: TxEntity): WasmCodeInfo {
  const msgs: Transaction.Message[] = get(tx.data, 'tx.value.msg')
  const msg: Transaction.Message[] = filter(msgs, { type: 'wasm/StoreCode' })
  const sender = msg && msg.length ? get(msg[0], 'value.sender') : ''
  const txMemo = get(tx.data, 'tx.value.memo')
  const info = {
    txhash: tx.hash,
    timestamp: tx.timestamp.toISOString(),
    sender,
    txMemo
  }

  const logs: Transaction.Log[] = get(tx.data, 'logs')

  const event: Transaction.Event[] = filter(logs[0].events, { type: 'store_code' })

  const attributeObj =
    event && event.length
      ? event[0].attributes.reduce((acc, attr) => {
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
  console.log()
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
  return contract
}

function isValidSuccessfulStoreCodeTx(tx: TxEntity): boolean {
  const msgs: Transaction.Message[] = get(tx.data, 'tx.value.msg')
  const msg: Transaction.Message[] = filter(msgs, { type: 'wasm/StoreCode' })
  const sender = msg && msg.length ? get(msg[0], 'value.sender') : ''

  // not a store code event
  if (sender === '') return false

  const logs: Transaction.Log[] = get(tx.data, 'logs')
  const code = get(tx.data, 'code')
  if (!logs || logs.length === 0 || code) return false
  return true
}

function isValidSuccessfulContracTx(tx: TxEntity): boolean {
  const msgs: Transaction.Message[] = get(tx.data, 'tx.value.msg')
  const msg: Transaction.Message[] = filter(msgs, { type: 'wasm/InstantiateContract' })
  const valueObj = msg && msg.length ? get(msg[0], 'value') : {}
  const { owner } = valueObj

  if (!owner) return false

  const logs: Transaction.Log[] = get(tx.data, 'logs')
  if (!logs || logs.length === 0) return false

  const code = get(tx.data, 'code')
  if (code) return false

  return true
}

export async function saveWasmCodeAndContract(transactionEntityManager: EntityManager, txEntities: TxEntity[]) {
  const wasmCodes: WasmCodeEntity[] = txEntities.reduce((acc: WasmCodeEntity[], tx: TxEntity) => {
    if (isValidSuccessfulStoreCodeTx(tx)) {
      acc.push(generateWasmCodeEntity(tx))
    }
    return acc
  }, [] as WasmCodeEntity[])

  const wasmContracts: WasmContractEntity[] = txEntities.reduce((acc: WasmContractEntity[], tx: TxEntity) => {
    if (isValidSuccessfulContracTx(tx)) {
      acc.push(generateWasmContractEntity(tx))
    }
    return acc
  }, [] as WasmContractEntity[])
  logger.info(`Storing ${wasmCodes.length} codes and ${wasmContracts.length} contracts.`)
  await transactionEntityManager.save(wasmCodes)
  await transactionEntityManager.save(wasmContracts)
  logger.info(`Stored ${wasmCodes.length} codes and ${wasmContracts.length} contracts.`)
}
