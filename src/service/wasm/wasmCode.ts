import { getRepository, WhereExpression } from 'typeorm'

import { WasmCodeEntity } from 'orm'
import config from 'config'

import { APIError, ErrorTypes } from 'lib/error'

import { parseWasmTxMemo, ParsedMemo } from './helpers'

function addWasmCodeFilter(qb: WhereExpression, sender?: string, search?: string) {
  qb.where('chain_id = :chain_id', { chain_id: config.CHAIN_ID })
  if (sender) {
    qb.andWhere(`sender = :sender`, { sender })
  }

  if (search) {
    qb.andWhere(`tx_memo ILIKE :search_str`, { search_str: `%${search}%` })
  }
}

type WasmCodeParams = {
  page: number
  limit: number
  sender?: string
  search?: string
}

export type WasmCodeDetails = {
  code_id: string
  sender: string
  txhash: string
  timestamp: string
  info: ParsedMemo
}

export function getWasmCodeDetails(code: WasmCodeEntity): WasmCodeDetails {
  return {
    code_id: code.codeId,
    sender: code.sender,
    timestamp: code.timestamp.toISOString(),
    txhash: code.txHash,
    info: parseWasmTxMemo(code.txMemo)
  }
}

export async function getWasmCodes({
  page,
  limit,
  sender,
  search
}: WasmCodeParams): Promise<{
  totalCnt: number
  page: number
  limit: number
  codes: WasmCodeDetails[]
}> {
  const qb = getRepository(WasmCodeEntity).createQueryBuilder()

  addWasmCodeFilter(qb, sender, search)

  const totalCnt = await qb.getCount()

  qb.skip(limit * (page - 1))
    .take(limit)
    .orderBy(`timestamp`, 'DESC')

  const result = await qb.getMany()
  return {
    totalCnt,
    page,
    limit,
    codes: result.map(getWasmCodeDetails)
  }
}

export async function getWasmCode(codeId: string): Promise<WasmCodeDetails> {
  const code = await getRepository(WasmCodeEntity).findOne({
    codeId,
    chainId: config.CHAIN_ID
  })

  if (!code) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR, undefined, 'Code not found')
  }

  return getWasmCodeDetails(code)
}
