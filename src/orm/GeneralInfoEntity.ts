import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('general_info')
export default class GeneralInfoEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Index('index_gi_datetime')
  @Column({ unique: true })
  datetime: Date

  @Column({ type: 'float', nullable: true })
  taxRate: number | null

  @Column({ type: 'float', nullable: true })
  stakingRatio: number | null

  @Column({ type: 'jsonb', nullable: true })
  taxProceeds: Coins | null

  @Column({ type: 'jsonb', nullable: true })
  issuances: DenomMap | null

  @Column({ type: 'jsonb', nullable: true })
  communityPool: DenomMap | null

  @Column({ type: 'jsonb', nullable: true })
  taxCaps: DenomTaxCap[] | null

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  seigniorageProceeds: string | null

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  bondedTokens: string | null

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  notBondedTokens: string | null

  @Column()
  totalAccountCount: number

  @Column()
  activeAccountCount: number
}
