import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('richlist')
export default class RichListEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  denom: string

  @Column()
  account: string

  @Column('decimal', { precision: 40, scale: 10 })
  amount: string

  @Column({ type: 'float' })
  percentage: number
}
