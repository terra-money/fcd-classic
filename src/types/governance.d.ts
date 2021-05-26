interface LcdProposalProposer {
  proposal_id: string
  proposer: string
}

interface Deposit {
  depositEndTime: string
  totalDeposit: Coin[]
  minDeposit: Coin[]
}

interface ProposalContentValue {
  title: string
  description: string
  tax_rate?: string
  changes?: {
    subspace: string
    key: string
    value: string
  }[]
}
interface Content {
  type: string
  value: ProposalContentValue
}

interface LcdProposal {
  content: Content
  id: string
  status: number
  final_tally_result: LcdProposalTallyingParams
  submit_time: string
  deposit_end_time: string
  total_deposit: Coin[]
  voting_start_time: string
  voting_end_time: string
}

enum VoteOption {
  no = 'No',
  yes = 'Yes',
  nowithveto = 'NoWithVeto',
  abstain = 'Abstain'
}

interface LcdProposalVote {
  proposal_id: string // number
  voter: string // terra address
  option: VoteOption
}

interface LcdProposalDeposit {
  proposal_id: string // number
  depositor: string // terra address
  amount: Coin[]
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

interface VoteSummary {
  id: string // proposal id
  distribution: VoteDistribution // vote distribution
  count: VoteCount // vote count
  total: string // total amount of luna voted
  votingEndTime: string // proposal vote ending time in unix
  stakedLuna: string // total staked luna amount
  voters?: { [key: string]: VoteOption }
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
  deposit: Deposit
  vote?: VoteSummary
}
