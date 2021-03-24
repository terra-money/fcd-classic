import { getRepository, LessThan } from 'typeorm'

import { WasmCodeEntity } from 'orm'
import config from 'config'

import { APIError, ErrorTypes } from 'lib/error'

import { parseWasmTxMemo, ParsedMemo } from './helpers'

type WasmCodeParams = {
  offset: number
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
  offset,
  limit,
  sender,
  search
}: WasmCodeParams): Promise<{
  limit: number
  codes: WasmCodeDetails[]
}> {
  const qb = getRepository(WasmCodeEntity).createQueryBuilder()

  qb.where('chain_id = :chain_id', { chain_id: config.CHAIN_ID })

  if (offset) {
    qb.andWhere('offset = :offset', { offset: LessThan(offset) })
  }

  if (sender) {
    qb.andWhere(`sender = :sender`, { sender })
  }

  if (search) {
    qb.andWhere(`tx_memo ILIKE :search_str`, { search_str: `%${search}%` })
  }

  qb.take(limit).orderBy(`timestamp`, 'DESC')

  const result = await qb.getMany()
  return {
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
