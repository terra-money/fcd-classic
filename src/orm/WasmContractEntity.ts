import { Column, Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn, JoinTable } from 'typeorm'
import WasmCodeEntity from './WasmCodeEntity'

@Entity('wasm_contract')
@Index('index_wasm_code_chain_id_contract_address', ['chainId', 'contractAddress'], { unique: true })
export default class WasmContractEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  codeId: string

  @Index('wcontract_index_owner')
  @Column()
  owner: string

  @Column()
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

  @Column()
  chainId: string

  @Column({ default: false })
  migratable: boolean

  @Column({ nullable: true })
  migrateMsg: string

  @ManyToOne(() => WasmCodeEntity, (code) => code, {
    eager: true
  })
  @JoinColumn([
    { name: 'code_id', referencedColumnName: 'codeId' },
    { name: 'chain_id', referencedColumnName: 'chainId' }
  ])
  code: WasmCodeEntity
}
