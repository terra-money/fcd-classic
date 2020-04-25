import { Column, Entity, PrimaryGeneratedColumn, Index, OneToOne, JoinColumn } from 'typeorm'

import BlockEntity from './BlockEntity'

@Entity('blockreward')
export default class BlockRewardEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ nullable: true })
  height: number

  @Index('blockreward_timestamp')
  @Column({ nullable: true })
  timestamp: Date

  @Index('blockreward_chain_id')
  @Column({ nullable: true })
  chainId: string

  @Column({ type: 'jsonb' })
  reward: object

  @Column({ type: 'jsonb' })
  commission: object

  @Column({ type: 'jsonb' })
  rewardPerVal: object

  @Column({ type: 'jsonb' })
  commissionPerVal: object

  @Index('block_reward_block')
  @OneToOne(() => BlockEntity, (block) => block.reward, { onDelete: 'CASCADE' })
  @JoinColumn()
  block: BlockEntity
}
