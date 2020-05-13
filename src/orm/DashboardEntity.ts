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

  @Column('decimal', { precision: 40, scale: 10, default: '0' })
  reward: string

  @Column('decimal', { precision: 40, scale: 10, default: '0' })
  avgStaking: string

  @Column('decimal', { precision: 40, scale: 10, default: '0' })
  taxReward: string

  @Column({ default: 0 })
  activeAccount: number

  @Column({ default: 0 })
  totalAccount: number
}
