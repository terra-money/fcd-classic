import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('validator_return_info')
@Index('vri_index_timestamp_operatorAddress', ['timestamp', 'operatorAddress'], { unique: true })
export default class ValidatorReturnInfoEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Index('vri_index_operator_address')
  @Column()
  operatorAddress: string

  @Index('vri_index_timestamp')
  @Column()
  timestamp: Date

  @Column('decimal', { precision: 40, scale: 10 })
  reward: string

  @Column('decimal', { precision: 40, scale: 10 })
  commission: string

  @Column('decimal', { precision: 40, scale: 10 })
  avgVotingPower: string
}
