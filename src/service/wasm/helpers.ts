import { apiLogger as logger } from 'lib/logger'

export type ParsedMemo = {
  name?: string
  description?: string
  repo_url?: string
  memo: string
}

export function parseWasmTxMemo(txMemo: string): ParsedMemo {
  let info = {
    memo: txMemo
  }

  try {
    const parsed = JSON.parse(txMemo)
    info = { ...parsed, ...info }
  } catch (error) {
    logger.error(error)
  }

  return info
}
