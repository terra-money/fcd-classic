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
    return (info = { ...parsed, memo: txMemo })
  } catch (e) {
    return info
  }
}
