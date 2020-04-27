interface LcdBlock {
  block: {
    data: any
    evidence: any
    header: LcdBlockHeader
    last_commit: any
  }
  block_meta: {
    block_id: {
      hash: string
      parts: {
        hash: string
        total: string
      }
    }
    header: LcdBlockHeader
  }
}

interface LcdBlockHeader {
  app_hash: string
  chain_id: string
  consensus_hash: string
  data_hash: string
  evidence_hash: string
  height: string
  last_block_id: {
    hash: string
    parts: {
      hash: string
      total: string
    }
  }
  last_commit_hash: string
  last_results_hash: string
  next_validators_hash: string
  num_txs: string
  proposer_address: string
  time: string
  total_txs: string
  validators_hash: string
  version: {
    app: string
    block: string
  }
}

interface LcdValidator {
  commission: LcdValidatorCommission
  consensus_pubkey: string
  delegator_shares: string
  description: LcdValidatorDescription
  jailed: boolean
  min_self_delegation: string
  operator_address: string
  status: number
  tokens: string
  unbonding_height: string
  unbonding_time: string
}

interface LcdValidatorDescription {
  details: string
  identity: string
  moniker: string
  website: string
}

interface LcdValidatorCommission {
  commission_rates: {
    max_change_rate: string
    max_rate: string
    rate: string
  }
  update_time: string
}

interface LcdLatestValidatorSet {
  block_height: string
  validators: LcdLatestValidator[]
}

interface LcdLatestValidator {
  address: string
  proposer_priority: string
  pub_key: string
  voting_power: string
}

interface LcdValidatorSigningInfo {
  address: string // terravalcons...
  index_offset: string
  jailed_until: string
  missed_blocks_counter: string
  start_height: string
  tombstoned: boolean
}

interface LcdRewardPoolItem {
  denom: string
  amount: string
}

interface LcdRewardPool {
  operator_address: string
  self_bond_rewards: LcdRewardPoolItem[]
  val_commission: LcdRewardPoolItem[]
}

interface LcdValidatorDelegationItem {
  delegator_address: string
  shares: string
  validator_address: string
}

interface ValidatorCommission {
  maxChangeRate: string
  maxRate: string
  rate: string
  updateTime: string
}

interface Validator {
  commision: number
  moniker: stinrg
  rewardPool: number
  uptime: number
  votingPower: number
}

interface Delegator {
  address: string
  amount: string
  weight: string
}

interface ValidatorAnnualReturn {
  isNewValidator: boolean
  stakingReturn: string
}
