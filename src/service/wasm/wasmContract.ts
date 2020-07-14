import { getRepository, Raw, FindConditions } from 'typeorm'

import { WasmContractEntity } from 'orm'
import config from 'config'

import { APIError, ErrorTypes } from 'lib/error'

import { parseWasmTxMemo, ParsedMemo } from './helpers'
import { getWasmCodeDetails, WasmCodeDetails } from './wasmCode'

function buildContractFindConditions(
  owner?: string,
  search?: string,
  codeId?: string
): FindConditions<WasmContractEntity>[] {
  const commonCondition: FindConditions<WasmContractEntity> = {
    chainId: config.CHAIN_ID
  }

  if (owner) {
    commonCondition['owner'] = owner
  }

  if (codeId) {
    commonCondition['codeId'] = codeId
  }

  let whereCondition: FindConditions<WasmContractEntity>[] = [commonCondition]
  if (search) {
    whereCondition = [
      {
        ...commonCondition,
        txMemo: Raw((alias) => `${alias} ILIKE '%${search}%'`)
      },
      {
        ...commonCondition,
        initMsg: Raw((alias) => `${alias} ILIKE '%${search}%'`)
      }
    ]
  }
  return whereCondition
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
  code: WasmCodeDetails
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
    info: parseWasmTxMemo(contract.txMemo),
    code: getWasmCodeDetails(contract.code)
  }
}

type WasmContractParams = {
  page: number
  limit: number
  owner?: string
  search?: string
  codeId?: string
}

export async function getWasmContracts({
  page,
  limit,
  owner,
  search,
  codeId
}: WasmContractParams): Promise<{
  totalCnt: number
  page: number
  limit: number
  contracts: WasmContractDetails[]
}> {
  const [result, totalCnt] = await getRepository(WasmContractEntity).findAndCount({
    where: buildContractFindConditions(owner, search, codeId),
    skip: limit * (page - 1),
    take: limit,
    order: {
      timestamp: 'DESC'
    }
  })
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
