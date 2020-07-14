import { getRepository, WhereExpression, Brackets } from 'typeorm'

import { WasmContractEntity } from 'orm'
import config from 'config'

import { APIError, ErrorTypes } from 'lib/error'

import { parseWasmTxMemo, ParsedMemo } from './helpers'

function addWasmContractFilter(qb: WhereExpression, owner?: string, search?: string) {
  qb.where('chain_id = :chain_id', { chain_id: config.CHAIN_ID })
  if (owner) {
    qb.andWhere(`owner = :owner`, { owner })
  }
  if (search) {
    qb.andWhere(
      new Brackets((innerQ: WhereExpression) => {
        const searchStr = `%${search}%`
        innerQ.where(`tx_memo ILIKE :searchStr`, { searchStr })
        innerQ.orWhere(`init_msg ILIKE :searchStr`, { searchStr })
      })
    )
  }
}

type WasmContractDetails = {
  owner: string
  code_id: string
  init_msg: string
  txhash: string
  timestamp: string
  contract_address: string
  migratable: boolean
  migrate_msg: string
  info: ParsedMemo
}

function getWasmContractDetails(contract: WasmContractEntity): WasmContractDetails {
  return {
    owner: contract.owner,
    code_id: contract.codeId,
    init_msg: contract.initMsg,
    txhash: contract.txHash,
    timestamp: contract.timestamp.toISOString(),
    contract_address: contract.contractAddress,
    migratable: contract.migratable,
    migrate_msg: contract.migrateMsg,
    info: parseWasmTxMemo(contract.txMemo)
  }
}

type WasmContractParams = {
  page: number
  limit: number
  owner?: string
  search?: string
}

export async function getWasmContracts({
  page,
  limit,
  owner,
  search
}: WasmContractParams): Promise<{
  totalCnt: number
  page: number
  limit: number
  contracts: WasmContractDetails[]
}> {
  const qb = getRepository(WasmContractEntity).createQueryBuilder()
  addWasmContractFilter(qb, owner, search)

  const totalCnt = await qb.getCount()

  qb.skip(limit * (page - 1))
    .take(limit)
    .orderBy(`timestamp`, 'DESC')

  const result = await qb.getMany()
  return {
    totalCnt,
    page,
    limit,
    contracts: result.map(getWasmContractDetails)
  }
}

export async function getWasmContract(contractAddress: string): Promise<WasmContractDetails> {
  const contract = await getRepository(WasmContractEntity).findOne({
    contractAddress,
    chainId: config.CHAIN_ID
  })

  if (!contract) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR, undefined, 'Contract not found')
  }

  return getWasmContractDetails(contract)
}
