import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('account')
export default class AccountEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  address: string

  @Column()
  txcount: number

  @Index()
  @Column()
  createdAt: Date
}
