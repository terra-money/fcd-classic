import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('general_info')
export default class GeneralInfoEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  datetime: Date

  @Column({ type: 'float' })
  taxRate: number

  @Column({ type: 'float' })
  stakingRatio: number

  @Column({ type: 'jsonb', nullable: true })
  taxProceeds: Coins

  @Column({ type: 'jsonb', nullable: true })
  issuances: DenomMap

  @Column({ type: 'jsonb', nullable: true })
  communityPool: DenomMap

  @Column({ type: 'jsonb', nullable: true })
  taxCaps: DenomTaxCap[]

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  seigniorageProceeds: string

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  bondedTokens: string

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  notBondedTokens: string
}
