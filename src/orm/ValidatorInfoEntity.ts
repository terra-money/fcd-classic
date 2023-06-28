import { Column, Entity, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm'

export enum ValidatorStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  JAILED = 'jailed',
  UNBONDING = 'unbonding',
  UNKNOWN = 'unknown'
}

@Entity('validator_info')
export default class ValidatorInfoEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Index('vi_operator_address')
  @Column({ unique: true })
  operatorAddress: string

  @Index('vi_account_address')
  @Column()
  accountAddress: string

  @Column()
  moniker: string

  @Column({ default: '' })
  identity: string

  @Column({ default: '' })
  website: string

  @Column({ default: '' })
  securityContact: string

  @Column({ default: '' })
  details: string

  @Column({ default: '' })
  profileIcon: string

  @Index('vi_status')
  @Column()
  status: ValidatorStatus

  @Index('vi_jailed')
  @Column({ nullable: true, default: false })
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

  @Column({ nullable: true, type: 'jsonb' })
  public signingInfo: object

  @Column({ nullable: true, type: 'jsonb' })
  public rewardPool: object

  public createResponse(): ValidatorResponse {
    const {
      operatorAddress,
      tokens,
      delegatorShares,
      upTime,
      status,
      accountAddress,
      identity,
      moniker,
      website,
      securityContact,
      details,
      profileIcon,
      votingPower,
      votingPowerWeight,
      commissionRate,
      maxCommissionRate,
      maxCommissionChangeRate,
      commissionChangeDate,
      rewardPool,
      rewardPoolTotal,
      selfDelegation,
      selfDelegationWeight
    } = this

    return {
      operatorAddress,
      tokens,
      delegatorShares,
      upTime,
      status,
      accountAddress,
      description: {
        identity,
        moniker,
        website,
        securityContact,
        details,
        profileIcon
      },
      votingPower: {
        amount: votingPower,
        weight: votingPowerWeight
      },
      commissionInfo: {
        rate: commissionRate,
        maxRate: maxCommissionRate,
        maxChangeRate: maxCommissionChangeRate,
        updateTime: commissionChangeDate.toJSON()
      },
      rewardsPool: {
        total: rewardPoolTotal,
        denoms: rewardPool
      },
      selfDelegation: {
        amount: selfDelegation,
        weight: selfDelegationWeight
      }
    }
  }
}
