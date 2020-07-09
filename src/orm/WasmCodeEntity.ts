import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('wasm_code')
@Index('index_wasm_code_chain_id_code_id', ['chainId', 'codeId'], { unique: true })
export default class WasmCodeEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  sender: string

  @Column()
  codeId: string

  @Column()
  txHash: string

  @Column()
  txMemo: string

  @Column()
  chainId: string

  @Column()
  timestamp: Date
}
