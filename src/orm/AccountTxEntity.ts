import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm'

import TxEntity from './TxEntity'

@Entity('account_tx')
export default class AccountTxEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number

  @Index('account_tx_account')
  @Column()
  account: string

  @Index('account_tx_timestamp')
  @Column()
  timestamp: Date

  @Index('account_tx_tx_id')
  @ManyToOne(() => TxEntity, (tx) => tx.accounts, {
    cascade: ['insert'],
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'tx_id' })
  tx: TxEntity
}
