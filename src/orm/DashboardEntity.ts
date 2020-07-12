import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('dashboard')
@Index('UQ_dashboard', ['chainId', 'timestamp'], { unique: true })
export default class DashboardEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  timestamp: Date

  @Column()
  chainId: string

  @Column({ type: 'jsonb', nullable: true })
  txVolume: DenomMap

  @Column('decimal', { precision: 40, scale: 10, default: '0', nullable: true })
  reward: string

  @Column('decimal', { precision: 40, scale: 10, default: '0', nullable: true })
  avgStaking: string

  @Column('decimal', { precision: 40, scale: 10, default: '0', nullable: true })
  taxReward: string

  @Column({ default: 0 }) // TODO: legacy column. Will be removed on next release
  activeAccount: number

  @Column({ default: 0 }) // TODO: legacy column. Will be removed on next release
  totalAccount: number
}
