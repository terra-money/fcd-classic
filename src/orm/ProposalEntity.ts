import { Column, Entity, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn, In } from 'typeorm'

interface Voters {
  [operatorAddr: string]: string
}

@Entity('proposal')
@Index('pi_index_prop_id_chain_id', ['chainId', 'proposalId'], { unique: true })
export default class ProposalEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  proposalId: string

  @Column()
  chainId: string

  @Column()
  proposer: string

  @Column()
  title: string

  @Column()
  type: string

  @Column()
  status: string

  @Column()
  submitTime: Date

  @Column()
  depositEndTime: Date

  @Column()
  votingStartTime: Date

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
  public depositParams: LcdProposalDepositParams

  @Column({ type: 'jsonb' })
  public totalDeposit: Coin[]

  @Column({ type: 'jsonb' })
  public voteTxs: Transaction.LcdTransactions

  @Column({ type: 'jsonb' })
  public depositTxs: Transaction.LcdTransactions

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
