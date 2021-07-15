import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity('wasm_code')
export default class WasmCodeEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Index('wcode_index_sender')
  @Column()
  sender: string

  @Column({ unique: true })
  codeId: string

  @Column()
  txHash: string

  @Index('wcode_index_memo')
  @Column()
  txMemo: string

  @Column()
  chainId: string

  @Index('wcode_index_timestamp')
  @Column()
  timestamp: Date
}
