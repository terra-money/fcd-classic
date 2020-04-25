import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('denom')
export default class DenomEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  active: boolean
}
