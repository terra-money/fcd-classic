import { TxEntity } from 'orm'
import { getRepository } from 'typeorm'

export async function getTx(txhash: string): Promise<Transaction.LcdTransaction | undefined> {
  const qb = getRepository(TxEntity)
    .createQueryBuilder()
    .where('hash = lower(:txhash) OR hash=upper(:txhash) ', { txhash })

  const tx = await qb.getOne()
  return tx && (tx.data as Transaction.LcdTransaction)
}
