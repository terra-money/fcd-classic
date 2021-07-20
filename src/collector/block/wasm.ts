import * as Bluebird from 'bluebird'
import { DeepPartial, EntityManager } from 'typeorm'
import { TxEntity, WasmCodeEntity, WasmContractEntity } from 'orm'
import { collectorLogger as logger } from 'lib/logger'

function generateWasmContracts(tx: TxEntity): DeepPartial<WasmContractEntity>[] {
  return tx.data.tx.value.msg
    .map(
      (msg, index) =>
        ((tx.data.logs && tx.data.logs[index].events) || [])
          .map((ev) => {
            const contracts: DeepPartial<WasmContractEntity>[] = []

            if (ev.type === 'instantiate_contract') {
              for (let i = 0; i < ev.attributes.length; i += 3) {
                contracts.push({
                  contractAddress: ev.attributes[i + 2].value,
                  codeId: ev.attributes[i + 1].value,
                  initMsg: Buffer.from(msg.value.init_msg, 'base64').toString(),
                  owner: ev.attributes[i].value,
                  timestamp: tx.timestamp,
                  txHash: tx.hash,
                  txMemo: msg.value.txMemo || '',
                  migratable: msg.value.migratable
                })
              }
              return contracts
            } else if (ev.type === 'migrate_contract') {
              for (let i = 0; i < ev.attributes.length; i += 2) {
                contracts.push({
                  contractAddress: ev.attributes[i + 1].value,
                  codeId: ev.attributes[i].value,
                  migrateMsg: Buffer.from(msg.value.migrate_msg, 'base64').toString()
                })
              }
            } else if (ev.type === 'update_contract_admin') {
              for (let i = 0; i < ev.attributes.length; i += 2) {
                contracts.push({
                  contractAddress: ev.attributes[i + 1].value,
                  owner: ev.attributes[i].value
                })
              }
            } else if (ev.type === 'clear_contract_admin') {
              for (let i = 0; i < ev.attributes.length; i += 1) {
                contracts.push({
                  contractAddress: ev.attributes[i].value,
                  owner: ''
                })
              }
            } else if (ev.type === 'update_contract_owner') {
              // Columbus-4
              for (let i = 0; i < ev.attributes.length; i += 2) {
                contracts.push({
                  contractAddress: ev.attributes[i + 1].value,
                  owner: ev.attributes[i].value
                })
              }
            }

            if (contracts.length) {
              return contracts
            }
          })
          .flat()
          .filter(Boolean) as DeepPartial<WasmContractEntity>[]
    )
    .flat()
}

function generateWasmCodes(tx: TxEntity): DeepPartial<WasmCodeEntity>[] {
  return tx.data.tx.value.msg
    .map(
      (msg, index) =>
        ((tx.data.logs && tx.data.logs[index].events) || [])
          .map((ev) => {
            const codes: DeepPartial<WasmCodeEntity>[] = []

            if (ev.type === 'store_code') {
              for (let i = 0; i < ev.attributes.length; i += 2) {
                codes.push({
                  codeId: ev.attributes[i + 1].value,
                  sender: ev.attributes[i].value,
                  txHash: tx.hash,
                  txMemo: msg.value.txMemo || '',
                  timestamp: tx.timestamp
                })
              }
            }

            if (codes.length) {
              return codes
            }
          })
          .flat()
          .filter(Boolean) as DeepPartial<WasmCodeEntity>[]
    )
    .flat()
}

export async function collectWasm(mgr: EntityManager, txEntities: TxEntity[]) {
  await Bluebird.mapSeries(txEntities, async (tx) => {
    await Bluebird.map(generateWasmCodes(tx), async (code) => {
      const existingEntity = await mgr.findOne(WasmCodeEntity, { codeId: code.codeId })

      if (existingEntity) {
        logger.info(`collectWasm: update code ${code.codeId}`)
        return mgr.update(WasmCodeEntity, existingEntity.id, code)
      } else {
        logger.info(`collectWasm: new code ${code.codeId}`)
        return mgr.save(WasmCodeEntity, code)
      }
    })

    await Bluebird.map(generateWasmContracts(tx), async (contract) => {
      const existingEntity = await mgr.findOne(WasmContractEntity, { contractAddress: contract.contractAddress })

      if (existingEntity) {
        logger.info(`collectWasm: update contract ${contract.contractAddress}`)
        return mgr.update(WasmContractEntity, existingEntity.id, contract)
      } else {
        logger.info(`collectWasm: new contract ${contract.contractAddress}`)
        return mgr.save(WasmContractEntity, contract)
      }
    })
  })
}
