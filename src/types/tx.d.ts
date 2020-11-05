declare namespace Transaction {
  interface Log {
    msg_index: number
    log:
      | string
      | {
          tax: string
        }
    events?: Event[]
  }

  interface Event {
    type: string
    attributes: {
      key: string
      value: string
    }[]
  }

  interface Value {
    fee: {
      amount: Coin[]
      gas: string
    }
    msg: Message[]
    signatures: Signature[]
    memo: string
  }

  interface Message {
    type: string
    value: { [key: string]: any }
  }

  interface Signature {
    pub_key: {
      type: string
      value: string
    }
    signature: string
  }

  interface LcdTx {
    type: string
    value: Value
  }

  interface LcdTransaction {
    height: string
    txhash: string
    raw_log: string
    logs: Log[] // doesn't exist if tx failed
    gas_wanted: string
    gas_used: string
    codespace: string
    code?: number
    tx: LcdTx
    timestamp: string // unix time at GMT 0
    events: Event[]
  }

  interface LcdTransactions {
    total_count: string
    count: string
    page_number: string
    page_total: string
    limit: string
    txs: LcdTransaction[]
  }

  interface LcdPostTransaction {
    height: string
    txhash: string
    code?: number
    raw_log?: string
    logs?: Log[]
  }
}

interface TxVolume {
  datetime: number // unix time
  txVolume: string // big int tx amount
}

interface DenomTxVolumeObject {
  [denom: string]: TxVolume[]
}

interface DenomTxVolume {
  denom: string // denom name
  data: TxVolume[]
}

interface TxVolumeReturn {
  periodic: DenomTxVolume[]
  cumulative: DenomTxVolume[]
}

interface ParsedTxMsgInfo {
  tag?: string
  text?: string
  tax?: string
  in?: any[]
  out?: Coin[]
}

interface ParsedTxInfo {
  id: number
  timestamp: string
  txhash: string
  msgs: ParsedTxMsgInfo[]
  txFee: string
  memo: string
  success: boolean
  errorMessage?: string
  chainId: string
}
