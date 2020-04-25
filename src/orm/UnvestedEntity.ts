import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('unvested')
export default class UnvestedEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  datetime: Date

  @Column()
  denom: string

  @Column('decimal', { precision: 40, scale: 10 })
  amount: string
}
