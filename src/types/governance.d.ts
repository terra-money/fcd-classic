interface LcdProposalProposer {
  proposal_id: string
  proposer: string
}

interface LcdProposal {
  content: {
    type: string
    value: {
      title: string
      description: string
      tax_rate?: string
      changes?: {
        subspace: string
        key: string
        value: string
      }[]
    }
  }
  id: string
  proposal_status: string
  final_tally_result: LcdProposalTallyingParams
  submit_time: string
  deposit_end_time: string
  total_deposit: Coin[]
  voting_start_time: string
  voting_end_time: string
}

enum voteOption {
  no = 'No',
  yes = 'Yes',
  nowithveto = 'NoWithVeto',
  abstain = 'Abstain'
}

interface LcdProposalVote {
  option: voteOption
  proposal_id: string
  voter: string
}

interface LcdProposalTally {
  abstain: string
  no: string
  no_with_veto: string
  yes: string
}

interface LcdProposalDepositParams {
  max_deposit_period: string
  min_deposit: Coin[]
}

interface LcdProposalVotingParams {
  voting_period: string
}

interface LcdProposalTallyingParams {
  quorum: string
  threshold: string
  veto: string
}

interface VoteDistribution {
  Yes: string // big int - staked luna amount on yes vote
  No: string // big int - staked luna amount on no vote
  NoWithVeto: string // big int - staked luna amount on veto
  Abstain: string // big int - staked luna amount on abstain
}

interface VoteCount {
  Yes: number // yes vote count
  No: number // no vote count
  NoWithVeto: number // veto count
  Abstain: number // abstain count
}

interface TallyingInfo {
  distribution: VoteDistribution
  total: string // big int - total staked luna attended on vote
}

interface ProposalBasic {
  id: string
  type: string
  proposer: {
    accountAddress: string
    operatorAddress?: string
    moniker?: string
  }
  submitTime: string
  title: string
  description: string
  status: string
  deposit?: {
    depositEndTime: string
    totalDeposit: Coin[]
    minDeposit: Coin[]
  }
  vote?: VoteSummary
}
