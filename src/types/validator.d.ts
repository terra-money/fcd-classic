interface ValidatorResponse {
  accountAddress: string
  commissionInfo: {
    rate: string
    maxRate: string
    maxChangeRate: string
    updateTime: string
  }
  delegatorShares: string
  description: {
    identity: string
    moniker: string
    website: string
    details: string
    profileIcon: string
    securityContact: string
  }
  isNewValidator: boolean
  operatorAddress: string
  rewardsPool: {
    total: string
    denoms: object
  }
  selfDelegation: {
    amount: string
    weight: string
  }
  stakingReturn: string
  status: string
  tokens: string
  upTime: number
  votingPower: {
    amount: string
    weight: string
  }
}

// TODO: Need to rename this interface to UndelegationDetails
interface UndeligationSchedule {
  releaseTime: string // undelegation token release date time
  amount: string // bigint undelegation amount
  validatorName: string // validator moniker
  validatorAddress: string // validator address
  validatorStatus: string // validator status
  creationHeight: string // height undelegation created
}

type DenomMapByValidator = { [validator: string]: DenomMap }
