import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('network')
@Index('index_with_denom_and_date', ['denom', 'datetime'], { unique: true })
export default class NetworkEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  denom: string

  @Column()
  datetime: Date

  @Column('decimal', { precision: 40, scale: 10 })
  supply: string

  @Column('decimal', { precision: 40, scale: 10 })
  marketCap: string

  @Column('decimal', { precision: 40, scale: 10 })
  txvolume: string
}
