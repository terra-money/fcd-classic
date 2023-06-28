import { APIError, ErrorTypes } from 'lib/error'
import { TxEntity } from 'orm'
import { getRepository } from 'typeorm'

type FcdTx = Transaction.LcdTransaction & { chainId: string }

export async function getTx(txhash: string): Promise<FcdTx> {
  const qb = getRepository(TxEntity)
    .createQueryBuilder()
    .where('hash=lower(:txhash) OR hash=upper(:txhash) ', { txhash })

  const tx = await qb.getOne()
  if (!tx) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR)
  }
  return tx.data && { ...(tx.data as Transaction.LcdTransaction), chainId: tx.chainId }
}
