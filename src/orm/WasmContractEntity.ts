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
  @Column()
  owner: string

  // New from columbus-5
  @Column()
  creator: string

  @Column({ unique: true })
  contractAddress: string

  @Column()
  initMsg: string

  @Column()
  txHash: string

  @Index('wcontract_index_memo')
  @Column()
  txMemo: string

  @Index('wcontract_index_timestamp')
  @Column()
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
