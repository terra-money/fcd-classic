import { TxEntity } from 'orm'
import { getRepository } from 'typeorm'

export async function getTx(txhash: string): Promise<Transaction.LcdTransaction | undefined> {
  const tx = await getRepository(TxEntity).findOne({
    hash: txhash.toLowerCase()
  })
  return tx && (tx.data as Transaction.LcdTransaction)
}
