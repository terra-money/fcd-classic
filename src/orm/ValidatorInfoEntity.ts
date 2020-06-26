import { Column, Entity, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm'

export enum ValidatorStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  JAILED = 'jailed',
  UNBONDING = 'unbonding',
  UNKNOWN = 'unknown'
}

@Entity('validator_info')
@Index('vi_index_chainId_accountAddress', ['chainId', 'accountAddress'], { unique: true })
export default class ValidatorInfoEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Index('vi_chain_id')
  @Column()
  chainId: string

  @Index('vi_operator_address')
  @Column()
  operatorAddress: string

  @Index('vi_cons_pub_key')
  @Column()
  consensusPubkey: string

  @Index('vi_account_address')
  @Column()
  accountAddress: string

  @Column()
  moniker: string

  @Column()
  identity: string

  @Column()
  website: string

  @Column()
  details: string

  @Column()
  profileIcon: string

  @Index('vi_status')
  @Column()
  status: ValidatorStatus

  @Index('vi_jailed')
  @Column()
  jailed: boolean

  @Column()
  missedOracleVote: number

  @Column('real')
  upTime: number

  @Column()
  unbondingHeight: number

  @Column('decimal', { precision: 40, scale: 10 })
  tokens: string

  @Column('decimal', { precision: 40, scale: 10 })
  delegatorShares: string

  @Column('decimal', { precision: 40, scale: 10 })
  votingPower: string

  @Column('decimal', { precision: 40, scale: 10 })
  votingPowerWeight: string

  @Column('decimal', { precision: 40, scale: 10 })
  commissionRate: string

  @Column('decimal', { precision: 40, scale: 10 })
  maxCommissionRate: string

  @Column('decimal', { precision: 40, scale: 10 })
  maxCommissionChangeRate: string

  @Column('decimal', { precision: 40, scale: 10 })
  selfDelegation: string

  @Column('decimal', { precision: 40, scale: 10 })
  selfDelegationWeight: string

  @Column('decimal', { precision: 40, scale: 10 })
  rewardPoolTotal: string

  @Column()
  commissionChangeDate: Date

  @Column()
  unbondingTime: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @Column({ type: 'jsonb' })
  public signingInfo: object

  @Column({ type: 'jsonb' })
  public rewardPool: object
}
