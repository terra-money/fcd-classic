import * as Bluebird from 'bluebird'
import { DeepPartial, EntityManager } from 'typeorm'
import { TxEntity, WasmCodeEntity, WasmContractEntity } from 'orm'
import { collectorLogger as logger } from 'lib/logger'

function findAttribute(attributes: { key: string; value: string }[], key: string): string | undefined {
  for (let i = 0; i < attributes.length; i += 1) {
    if (attributes[i].key === key) {
      return attributes[i].value
    }
  }
}

function generateWasmContracts(tx: TxEntity): DeepPartial<WasmContractEntity>[] {
  if (tx.data.code) {
    return []
  }

  return tx.data.tx.value.msg
    .map(
      (msg, index) =>
        ((tx.data.logs && tx.data.logs[index].events) || [])
          .map((ev) => {
            const contracts: DeepPartial<WasmContractEntity>[] = []

            if (ev.type === 'instantiate_contract') {
              contracts.push({
                contractAddress: findAttribute(ev.attributes, 'contract_address'),
                codeId: findAttribute(ev.attributes, 'code_id'),
                owner: findAttribute(ev.attributes, 'admin'),
                creator: findAttribute(ev.attributes, 'creator'),
                txHash: tx.hash,
                txMemo: msg.value.txMemo || '',
                timestamp: tx.timestamp,
                initMsg: JSON.stringify(msg.value.init_msg || {})
              })
            } else if (ev.type === 'migrate_contract') {
              contracts.push({
                contractAddress: findAttribute(ev.attributes, 'contract_address'),
                codeId: findAttribute(ev.attributes, 'code_id'),
                migrateMsg: JSON.stringify(msg.value.migrate_msg || {})
              })
            } else if (ev.type === 'update_contract_admin') {
              contracts.push({
                contractAddress: findAttribute(ev.attributes, 'contract_address'),
                owner: findAttribute(ev.attributes, 'admin')
              })
            } else if (ev.type === 'clear_contract_admin') {
              contracts.push({
                contractAddress: findAttribute(ev.attributes, 'contract_address'),
                owner: undefined
              })
            } else if (ev.type === 'update_contract_owner') {
              // The type exists in Columbus-4 only
              contracts.push({
                contractAddress: findAttribute(ev.attributes, 'contract_address'),
                owner: findAttribute(ev.attributes, 'owner')
              })
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
  if (tx.data.code) {
    return []
  }

  return tx.data.tx.value.msg
    .map(
      (msg, index) =>
        ((tx.data.logs && tx.data.logs[index].events) || [])
          .map((ev) => {
            const codes: DeepPartial<WasmCodeEntity>[] = []

            if (ev.type === 'store_code' || ev.type === 'migrate_code') {
              codes.push({
                codeId: findAttribute(ev.attributes, 'code_id'),
                sender: findAttribute(ev.attributes, 'sender'),
                txHash: tx.hash,
                txMemo: msg.value.txMemo || '',
                timestamp: tx.timestamp
              })
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

    // a contract may be instantiated & executed within the same block
    // let the contract "known" first, then just update
    const intraBlockContractFound: Record<string, DeepPartial<WasmContractEntity>> = {}
    await Bluebird.mapSeries(generateWasmContracts(tx), async (contract) => {
      const existingEntity = (await mgr.findOne(WasmContractEntity, { contractAddress: contract.contractAddress })) || intraBlockContractFound[contract.contractAddress!]

      if (existingEntity) {
        logger.info(`collectWasm: update contract ${contract.contractAddress}`)
        return mgr.update(WasmContractEntity, existingEntity.id, contract)
      } else {
        logger.info(`collectWasm: new contract ${contract.contractAddress}`)
        const record = await mgr.save(WasmContractEntity, contract)
        intraBlockContractFound[contract.contractAddress!] = record

        return record
      }
    })
  })
}
