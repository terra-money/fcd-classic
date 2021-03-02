import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('reward')
@Index('index_reward_with_denom_and_date', ['denom', 'datetime'], { unique: true })
export default class RewardEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Index('index_reward_denom')
  @Column()
  denom: string

  @Index('index_reward_datetime')
  @Column()
  datetime: Date

  @Column('decimal', { precision: 40, scale: 10 })
  tax: string

  @Column('decimal', { precision: 40, scale: 10 })
  taxUsd: string

  @Column('decimal', { precision: 40, scale: 10 })
  gas: string

  @Column('decimal', { precision: 40, scale: 10 })
  gasUsd: string

  @Column('decimal', { precision: 40, scale: 10 })
  oracle: string

  @Column('decimal', { precision: 40, scale: 10 })
  oracleUsd: string

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  sum: string | null

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  commission: string | null
}
