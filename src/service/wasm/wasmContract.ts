import { getRepository, SelectQueryBuilder } from 'typeorm'
import { WasmContractEntity } from 'orm'
import { APIError, ErrorTypes } from 'lib/error'
import { TERRA_ACCOUNT_REGEX } from 'lib/constant'
import { parseWasmTxMemo, ParsedMemo } from './helpers'
import { getWasmCodeDetails, WasmCodeDetails } from './wasmCode'

function applyFindCondition(
  qb: SelectQueryBuilder<WasmContractEntity>,
  offset?: number,
  owner?: string,
  search?: string
): SelectQueryBuilder<WasmContractEntity> {
  if (offset) {
    qb.where('contract.id < :offset', { offset })
  }

  if (owner) {
    qb.andWhere('owner = :owner', { owner }).orWhere('creator = :creator', { creator: owner })
  } else if (search) {
    // If it is all numbers, find it by code id
    if (/^\d+$/.test(search)) {
      qb.andWhere('codeId = :codeId', { codeId: search })
    } else if (TERRA_ACCOUNT_REGEX.test(search)) {
      qb.andWhere('owner = :owner', { owner: search })
        .orWhere('creator = :creator', { creator: search })
        .orWhere('contract_address = :contract_address', { contract_address: search })
    }
  }

  return qb
}

type WasmContractDetails = {
  id: number
  owner: string
  code_id: string
  init_msg: string
  txhash: string
  timestamp: string
  contract_address: string
  migrate_msg: string
  info: ParsedMemo
  code?: WasmCodeDetails
}

function transformToContractDetails(contract: WasmContractEntity): WasmContractDetails {
  return {
    id: contract.id,
    owner: contract.owner,
    code_id: contract.codeId,
    init_msg: contract.initMsg,
    txhash: contract.txHash,
    timestamp: contract.timestamp.toISOString(),
    contract_address: contract.contractAddress,
    migrate_msg: contract.migrateMsg,
    info: parseWasmTxMemo(contract.txMemo),
    code: contract.code && getWasmCodeDetails(contract.code)
  }
}

type WasmContractParams = {
  offset: number
  limit: number
  owner?: string
  search?: string
  codeId?: string
}

export async function getWasmContracts({ offset, limit, owner, search }: WasmContractParams): Promise<{
  contracts: WasmContractDetails[]
  limit: number
  next?: number
}> {
  const qb = await getRepository(WasmContractEntity)
    .createQueryBuilder('contract')
    .leftJoinAndSelect('contract.code', 'code')
    .take(limit + 1)
    .orderBy('contract.timestamp', 'DESC')

  applyFindCondition(qb, offset, owner, search)

  const result = await qb.getMany()
  let next

  if (limit + 1 === result.length) {
    next = result[limit - 1].id
    result.length -= 1
  }

  return {
    contracts: result.map(transformToContractDetails),
    limit,
    next
  }
}

export async function getWasmContract(contractAddress: string): Promise<WasmContractDetails> {
  const contract = await getRepository(WasmContractEntity).findOne({ contractAddress })

  if (!contract) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR, undefined, 'Contract not found')
  }

  return transformToContractDetails(contract)
}
