import { getRepository, Raw, FindConditions, LessThan } from 'typeorm'

import { WasmContractEntity } from 'orm'
import config from 'config'

import { APIError, ErrorTypes } from 'lib/error'

import { parseWasmTxMemo, ParsedMemo } from './helpers'
import { getWasmCodeDetails, WasmCodeDetails } from './wasmCode'

function buildContractFindConditions(
  offset?: number,
  owner?: string,
  search?: string,
  codeId?: string
): FindConditions<WasmContractEntity>[] {
  const commonCondition: FindConditions<WasmContractEntity> = {}

  if (offset) {
    commonCondition['id'] = LessThan(offset)
  }

  if (owner) {
    commonCondition['owner'] = owner
  }

  // if (codeId) {
  //   commonCondition['codeId'] = codeId
  // }

  let whereCondition: FindConditions<WasmContractEntity>[] = [commonCondition]

  if (search) {
    whereCondition = [
      {
        ...commonCondition,
        txMemo: Raw((alias) => `${alias} ILIKE '%${search}%'`)
      }
      // {
      //   ...commonCondition,
      //   initMsg: Raw((alias) => `${alias} ILIKE '%${search}%'`)
      // }
    ]
  }

  return whereCondition
}

type WasmContractDetails = {
  id: number
  owner: string
  code_id: string
  init_msg: string
  txhash: string
  timestamp: string
  contract_address: string
  migratable: boolean
  migrate_msg: string
  info: ParsedMemo
  code: WasmCodeDetails
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
    migratable: contract.migratable,
    migrate_msg: contract.migrateMsg,
    info: parseWasmTxMemo(contract.txMemo),
    code: getWasmCodeDetails(contract.code)
  }
}

type WasmContractParams = {
  offset: number
  limit: number
  owner?: string
  search?: string
  codeId?: string
}

export async function getWasmContracts({ offset, limit, owner, search, codeId }: WasmContractParams): Promise<{
  contracts: WasmContractDetails[]
  limit: number
  next?: number
}> {
  const result = await getRepository(WasmContractEntity).find({
    where: buildContractFindConditions(offset, owner, search, codeId),
    take: limit + 1,
    order: {
      timestamp: 'DESC'
    }
  })
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
  const contract = await getRepository(WasmContractEntity).findOne({
    contractAddress
  })

  if (!contract) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR, undefined, 'Contract not found')
  }

  return transformToContractDetails(contract)
}
