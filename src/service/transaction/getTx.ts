import Mempool, { MempoolItemResponse } from 'lib/mempool'
import { TxEntity } from 'orm'
import { getRepository } from 'typeorm'

type FcdTx = (Transaction.LcdTransaction & { chainId: string }) | MempoolItemResponse

export async function getTx(txhash: string): Promise<FcdTx | undefined> {
  const mempoolItem = Mempool.getTransactionByHash(txhash)

  if (mempoolItem) {
    return mempoolItem
  }

  const qb = getRepository(TxEntity)
    .createQueryBuilder()
    .where('hash=lower(:txhash) OR hash=upper(:txhash) ', { txhash })

  const tx = await qb.getOne()
  return tx?.data && { ...(tx.data as Transaction.LcdTransaction), chainId: tx.chainId }
}
