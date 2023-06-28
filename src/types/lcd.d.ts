interface LcdBlock {
  block_id: LcdBlockId
  block: {
    header: LcdBlockHeader
    data: {
      txs: string[]
    }
    evidence: any
    last_commit: LcdBlockLastCommit
  }
}

interface LcdBlockLastCommit {
  height: string
  round: string
  block_id: LcdBlockId
  signatures: LcdBlockSignature[]
}

interface LcdBlockSignature {
  block_id_flag: number
  validator_address: string
  timestamp: string
  signature: string
}

interface LcdBlockId {
  hash: string
  parts: {
    total: string
    hash: string
  }
}

interface LcdBlockHeader {
  version: {
    app: string
    block: string
  }
  chain_id: string
  height: string
  time: string
  last_block_id: LcdBlockId
  last_commit_hash: string
  data_hash: string
  validators_hash: string
  next_validators_hash: string
  consensus_hash: string
  app_hash: string
  last_results_hash: string
  evidence_hash: string
  proposer_address: string
}

type LcdValidatorStatus = 'BOND_STATUS_UNBONDED' | 'BOND_STATUS_UNBONDING' | 'BOND_STATUS_BONDED'

interface LcdValidator {
  operator_address: string
  consensus_pubkey: {
    '@type': string
    key: string
  }
  jailed: boolean
  status: LcdValidatorStatus
  tokens: string
  delegator_shares: string
  description: LcdValidatorDescription
  unbonding_height: string
  unbonding_time: string
  commission: LcdValidatorCommission
  min_self_delegation: string
}

interface LcdValidatorDescription {
  moniker: string
  identity: string
  website: string
  security_contact: string
  details: string
}

interface LcdValidatorCommission {
  commission_rates: {
    max_change_rate: string
    max_rate: string
    rate: string
  }
  update_time: string
}

interface LcdValidatorSets {
  block_height: string
  validators: LcdValidatorConsensus[]
}

interface LcdValidatorConsensus {
  address: string
  pub_key: {
    '@type': string
    key: string
  }
  voting_power: string
  proposer_priority: string
}

interface LcdValidatorSigningInfo {
  address: string // terravalcons...
  index_offset: string
  jailed_until: string
  missed_blocks_counter: string
  start_height: string
  tombstoned: boolean
}

interface LcdRewardPool {
  operator_address: string
  self_bond_rewards: Coin[]
  val_commission: {
    commission: Coin[]
  }
}

interface LcdValidatorDelegationItem {
  delegation: {
    delegator_address: string
    shares: string
    validator_address: string
  }
  balance: Coin
}
