import { Column, Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm'
import WasmCodeEntity from './WasmCodeEntity'

@Entity('wasm_contract')
export default class WasmContractEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  codeId: string

  // `admin` from columbus-5
  @Index('wcontract_index_owner')
  @Column({ nullable: true })
  owner: string

  // New from columbus-5
  @Column({ nullable: true })
  creator: string

  @Column({ unique: true })
  contractAddress: string

  @Column({ nullable: true })
  initMsg: string

  @Column({ nullable: true })
  txHash: string

  @Index('wcontract_index_memo')
  @Column({ nullable: true })
  txMemo: string

  @Index('wcontract_index_timestamp')
  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date

  @Column({ nullable: true })
  migrateMsg: string

  @ManyToOne(() => WasmCodeEntity, (code) => code, {
    eager: true,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'code_id', referencedColumnName: 'codeId' })
  code: WasmCodeEntity
}
