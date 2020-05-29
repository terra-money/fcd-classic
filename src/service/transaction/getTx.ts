import { TxEntity } from 'orm'
import { getRepository } from 'typeorm'

export async function getTx(txhash: string): Promise<Transaction.LcdTransaction | undefined> {
  const tx = await getRepository(TxEntity)
    .createQueryBuilder()
    .where(`hash = :hash`, { hash: txhash.toLowerCase() })
    .orWhere(`hash = :hash`, { hash: txhash.toUpperCase() })
    .getOne()
  return tx && (tx[0].data as Transaction.LcdTransaction)
}
