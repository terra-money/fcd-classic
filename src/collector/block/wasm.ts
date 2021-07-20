import * as Bluebird from 'bluebird'
import { DeepPartial, EntityManager } from 'typeorm'
import { TxEntity, WasmCodeEntity, WasmContractEntity } from 'orm'
import { collectorLogger as logger } from 'lib/logger'

function generateWasmContracts(tx: TxEntity): DeepPartial<WasmContractEntity>[] {
  return tx.data.tx.value.msg
    .map((msg, index) =>
      (tx.data.logs[index].events || [])
        .map((ev) => {
          const attributeObj = ev.attributes.reduce((acc, attr) => {
            acc[attr.key] = attr.value
            return acc
          }, {} as { [key: string]: string })

          if (ev.type === 'instantiate_contract') {
            return {
              contractAddress: attributeObj.contract_address,
              codeId: attributeObj.code_id,
              initMsg: Buffer.from(msg.value.init_msg, 'base64').toString(),
              owner: attributeObj.owner || attributeObj.admin,
              timestamp: tx.timestamp,
              txHash: tx.hash,
              txMemo: msg.value.txMemo,
              migratable: msg.value.migratable
            }
          } else if (ev.type === 'migrate_contract') {
            return {
              contractAddress: attributeObj.contract_address,
              codeId: attributeObj.code_id,
              migrateMsg: Buffer.from(msg.value.migrate_msg, 'base64').toString()
            }
          } else if (ev.type === 'update_contract_admin') {
            return {
              contractAddress: attributeObj.contract_address,
              owner: attributeObj.admin
            }
          } else if (ev.type === 'clear_contract_admin') {
            return {
              contractAddress: attributeObj.contract_address,
              owner: ''
            }
          } else if (ev.type === 'update_contract_owner') {
            // Columbus-4
            return {
              contractAddress: attributeObj.contract_address,
              owner: attributeObj.owner
            }
          }

          return {}
        })
        .filter(Boolean)
        .flat()
    )
    .flat()
}

function generateWasmCodes(tx: TxEntity): DeepPartial<WasmCodeEntity>[] {
  return tx.data.tx.value.msg
    .map((msg, index) =>
      (tx.data.logs[index].events || [])
        .map((ev) => {
          const attributeObj = ev.attributes.reduce((acc, attr) => {
            acc[attr.key] = attr.value
            return acc
          }, {} as { [key: string]: string })

          if (ev.type === 'store_code') {
            return {
              codeId: attributeObj.code_id,
              sender: attributeObj.sender,
              txHash: tx.hash,
              txMemo: msg.value.txMemo,
              timestamp: tx.timestamp
            }
          }

          return {}
        })
        .filter(Boolean)
        .flat()
    )
    .flat()
}

export async function collectWasm(mgr: EntityManager, txEntities: TxEntity[]) {
  const newWasmCodes: DeepPartial<WasmCodeEntity>[] = []
  const newWasmContracts: DeepPartial<WasmContractEntity>[] = []

  for (let i = 0; i < txEntities.length; ++i) {
    const tx = txEntities[i]

    await Bluebird.map(generateWasmCodes(tx), async (code) => {
      const existingEntity = await mgr.findOne(WasmCodeEntity, { codeId: code.codeId })

      if (existingEntity) {
        logger.info(`collectWasm: update code ${code.codeId}`)
        await mgr.update(WasmCodeEntity, existingEntity.id, code)
      } else {
        newWasmCodes.push(code)
      }
    })

    await Bluebird.map(generateWasmContracts(tx), async (contract) => {
      const existingEntity = await mgr.findOne(WasmContractEntity, { contractAddress: contract.contractAddress })

      if (existingEntity) {
        logger.info(`collectWasm: update contract ${contract.contractAddress}`)
        await mgr.update(WasmContractEntity, existingEntity.id, contract)
      } else {
        newWasmContracts.push(contract)
      }
    })
  }

  if (newWasmCodes.length) {
    logger.info(`collectWasm: new code x ${newWasmCodes.length}`)
    await mgr.save(newWasmCodes)
  }

  if (newWasmContracts.length) {
    logger.info(`collectWasm: new contract x ${newWasmContracts.length}`)
    await mgr.save(newWasmContracts)
  }
}
