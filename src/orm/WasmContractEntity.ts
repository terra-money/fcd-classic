import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

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
}
