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

  type Message = { [key: string]: any }

  interface Body {
    messages: Message[]
    memo: string
    timeout_height?: string
  }

  interface Fee {
    amount: Coin[]
    gas_limit: string
    payer: string
    granter: string
  }

  interface SignerInfo {
    public_key: {
      '@type': string
      key: string
    }
    // ignore mode_info:
    sequence: string
  }

  interface AuthInfo {
    signer_infos: SignerInfo[]
    fee: Fee
  }

  interface LcdTx {
    body: Body
    auth_info: AuthInfo
    signatures: string[]
  }

  interface AminoMesssage {
    type: string
    value: { [key: string]: any }
  }

  interface AminoSignature {
    pub_key: {
      type: string
      value: string
    }
    signature: string
  }

  interface AminoTx {
    type: string
    value: {
      fee: {
        amount: Coin[]
        gas: string
      }
      msg: AminoMesssage[]
      signatures: AminoSignature[]
      memo: string
      timeout_height?: string
    }
  }

  interface LcdTransaction {
    height: string
    txhash: string
    codespace?: string
    code?: number
    raw_log: string
    logs: Log[]
    gas_wanted: string
    gas_used: string
    tx: AminoTx
    timestamp: string // unix time (GMT)
  }

  interface LcdTransactions {
    total_count: string
    count: string
    page_number: string
    page_total: string
    limit: string
    txs: LcdTransaction[]
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
  txFee: Coin[]
  memo: string
  success: boolean
  errorMessage?: string
}
