import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('price')
export default class PriceEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Index('index_price_denom')
  @Column()
  denom: string

  @Index('index_price_datetime')
  @Column()
  datetime: Date

  @Column({ type: 'float' })
  price: number
}
