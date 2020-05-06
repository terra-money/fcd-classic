import { Column, Entity, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn, In } from 'typeorm'

interface Voters {
  [operatorAddr: string]: string
}

export enum ProposalStatus {
  DEPOSIT = 'DepositPeriod',
  VOTING = 'VotingPeriod',
  PASSED = 'Passed',
  REJECTED = 'Rejected',
  FAILED = 'Failed'
}

@Entity('proposal')
@Index('pi_index_prop_id_chain_id', ['chainId', 'proposalId'], { unique: true })
export default class ProposalEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Index('pi_prop_id')
  @Column()
  proposalId: string

  @Index('pi_chain_id')
  @Column()
  chainId: string

  @Index('pi_proposer')
  @Column()
  proposer: string

  @Column()
  title: string

  @Index('pi_type')
  @Column()
  type: string

  @Index('pi_status')
  @Column()
  status: ProposalStatus

  @Index('pi_submit_time')
  @Column()
  submitTime: Date

  @Index('pi_deposit_end_time')
  @Column()
  depositEndTime: Date

  @Index('pi_voting_start_time')
  @Column()
  votingStartTime: Date

  @Index('pi_voting_end_time')
  @Column()
  votingEndTime: Date

  @Column('decimal', { precision: 40, scale: 10 })
  totalVote: string

  @Column('decimal', { precision: 40, scale: 10 })
  stakedLuna: string

  @Column({ type: 'jsonb' })
  public content: Content

  @Column({ type: 'jsonb' })
  public voteDistribution: VoteDistribution

  @Column({ type: 'jsonb' })
  public voteCount: VoteCount

  @Column({ type: 'jsonb' })
  public voters: Voters

  @Column({ type: 'jsonb' })
  public tallyingParameters: LcdProposalTallyingParams

  @Column({ type: 'jsonb' })
  public deposit: Deposit

  @Column({ type: 'jsonb' })
  public voteTxs: Transaction.LcdTransactions

  @Column({ type: 'jsonb' })
  public depositTxs: Transaction.LcdTransactions

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
