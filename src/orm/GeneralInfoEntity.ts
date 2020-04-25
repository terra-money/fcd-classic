import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('general_info')
export default class GeneralInfoEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Index('index_gi_datetime')
  @Column({ unique: true })
  datetime: Date

  @Column({ nullable: true })
  currentEpoch: number

  @Column({ type: 'float', nullable: true })
  taxRate: number

  @Column({ type: 'float', nullable: true })
  stakingRatio: number

  @Column({ type: 'jsonb', nullable: true })
  taxProceeds: Coins

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  seigniorageProceeds: string

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  bondedTokens: string

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  notBondedTokens: string

  @Column()
  totalAccountCount: number

  @Column()
  activeAccountCount: number
}
