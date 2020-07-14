interface ContractInfo {
  owner: string
  code_id: string
  init_msg: string
  txhash: string
  timestamp: string
  contract_address: string
  txMemo: string
  migratable: boolean
}

interface WasmCodeInfo {
  txhash: string
  timestamp: string
  sender: string
  code_id: string
  txMemo: string
}
