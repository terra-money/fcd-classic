import { DeepPartial, EntityManager } from 'typeorm'
import { get, filter } from 'lodash'

import { TxEntity, WasmCodeEntity, WasmContractEntity } from 'orm'
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
  const { admin: owner = '', code_id, init_msg } = value

  const info = {
    owner,
    code_id,
    init_msg: JSON.stringify(init_msg),
    txhash: tx.hash,
    timestamp: tx.timestamp.toISOString(),
    txMemo
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

  contract.codeId = info.code_id
  contract.contractAddress = info.contract_address
  contract.initMsg = info.init_msg
  contract.owner = info.owner
  contract.timestamp = tx.timestamp
  contract.txHash = info.txhash
  contract.txMemo = info.txMemo
  return contract
}

function getMsgTypeAndStatus(tx: TxEntity): {
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

async function updateContract(mgr: EntityManager, wasmMigrationTxs: TxEntity[]) {
  for (const tx of wasmMigrationTxs) {
    const { type, value } = getTxMsgTypeAndValueMemo(tx)
    const wasmContract: DeepPartial<WasmContractEntity> = {}

    if (type === 'wasm/MsgMigrateContract') {
      // const { contract, owner, new_code_id, migrate_msg } = value
      wasmContract.owner = value.owner
      wasmContract.codeId = value.new_code_id
      wasmContract.migrateMsg = JSON.stringify(value.migrate_msg)
    } else if (type === 'wasm/MsgUpdateContractOwner') {
      // const { contract, new_owner, owner } = value
      wasmContract.owner = value.new_owner
    } else {
      throw new Error('Unknown type')
    }

    const existingContract = await mgr.findOne(WasmContractEntity, {
      contractAddress: value.contract
    })

    if (!existingContract) {
      throw new Error('Failed to update contract')
    }

    mgr.update(WasmContractEntity, existingContract.id, wasmContract)
  }
}

export async function saveWasmCodeAndContract(mgr: EntityManager, txEntities: TxEntity[]) {
  const wasmCodes: WasmCodeEntity[] = []
  const wasmContracts: WasmContractEntity[] = []
  const wasmTxToUpdate: TxEntity[] = []

  for (let i = 0; i < txEntities.length; ++i) {
    const tx = txEntities[i]
    const { msgType, failed } = getMsgTypeAndStatus(tx)

    if (failed) {
      continue
    }

    switch (msgType) {
      case `wasm/MsgStoreCode`: {
        const codeEntity = generateWasmCodeEntity(tx)

        const existingEntity = await mgr.findOne(WasmCodeEntity, { codeId: codeEntity.codeId })

        if (existingEntity) {
          await mgr.update(WasmCodeEntity, existingEntity.id, codeEntity)
        } else {
          wasmCodes.push(codeEntity)
        }
        break
      }
      case 'wasm/MsgInstantiateContract':
        wasmContracts.push(generateWasmContractEntity(tx))
        break
      case 'wasm/MsgMigrateContract':
        wasmTxToUpdate.push(tx)
        break
      case 'wasm/MsgUpdateContractOwner':
        wasmTxToUpdate.push(tx)
        break
      default:
        break
    }
  }

  logger.info(`Wasm: ${wasmCodes.length} new codes`)
  await mgr.save(wasmCodes)
  logger.info(`Wasm: ${wasmContracts.length} new contracts`)
  await mgr.save(wasmContracts)

  logger.info(`Wasm: ${wasmTxToUpdate.length} contract updates`)
  await updateContract(mgr, wasmTxToUpdate)
}
