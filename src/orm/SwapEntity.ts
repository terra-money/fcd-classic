import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('swap')
@Index('index_swap_with_denom_and_date', ['denom', 'datetime'], { unique: true })
export default class SwapEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  denom: string

  @Column()
  datetime: Date;

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  in: string

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  inUsd: string

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  out: string

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  outUsd: string

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  fee: string

  @Column({ type: 'decimal', precision: 40, scale: 10, nullable: true })
  feeUsd: string

  @Column({ type: 'float', nullable: true })
  spread: number
}
