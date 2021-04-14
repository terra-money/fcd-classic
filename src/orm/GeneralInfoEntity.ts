import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

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

  @Column({ type: 'jsonb' })
  taxProceeds: Coins

  @Column({ type: 'jsonb' })
  issuances: DenomMap

  @Column({ type: 'jsonb' })
  communityPool: DenomMap

  @Column({ type: 'jsonb' })
  taxCaps: DenomTaxCap[]

  @Column({ type: 'decimal', precision: 40, scale: 10 })
  seigniorageProceeds: string

  @Column({ type: 'decimal', precision: 40, scale: 10 })
  bondedTokens: string

  @Column({ type: 'decimal', precision: 40, scale: 10 })
  notBondedTokens: string
}
