import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm'

import TxEntity from './TxEntity'

@Entity('account_tx')
export default class AccountTxEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Index('account_tx_chain_id')
  @Column({ nullable: true })
  chainId: string

  @Index('account_tx_account')
  @Column()
  account: string

  @Index('account_tx_hash')
  @Column()
  hash: string

  @Index('account_tx_timestamp')
  @Column()
  timestamp: Date

  @Column()
  type: string

  @Index('account_tx_tx_id')
  @ManyToOne(() => TxEntity, (tx) => tx.accounts, {
    cascade: ['insert']
  })
  @JoinColumn({ name: 'tx_id' })
  tx: TxEntity
}
