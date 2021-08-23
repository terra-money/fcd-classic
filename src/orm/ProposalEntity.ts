import { Entity, Index, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

interface Voters {
  [address: string]: VoteOption
}

@Entity('proposal')
@Index('UQ_proposal', ['chainId', 'proposalId'], { unique: true })
export default class ProposalEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  proposalId: string

  @Column()
  chainId: string

  @Column({ type: 'varchar', nullable: true })
  proposer: string | null

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
  public votes: LcdProposalVote[]

  @Column({ type: 'jsonb' })
  public deposits: LcdProposalDeposit[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
