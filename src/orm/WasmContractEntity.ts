import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('wasm_contract')
@Index('index_wasm_code_chain_id_contract_address', ['chainId', 'contractAddress'], { unique: true })
export default class WasmContractEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  codeId: string

  @Column()
  owner: string

  @Column()
  contractAddress: string

  @Column()
  initMsg: string

  @Column()
  txHash: string

  @Column()
  txMemo: string

  @Column()
  timestamp: Date

  @Column()
  chainId: string
}
