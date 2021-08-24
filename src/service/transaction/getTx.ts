import Mempool from 'lib/mempool'
import { TxEntity } from 'orm'
import { getRepository } from 'typeorm'
import config from 'config'

type FcdTx =
  | (Transaction.LcdTransaction & { chainId: string })
  | {
      height: ''
      txhash: string
      tx: Transaction.LcdTx
      timestamp: string // First seen at
      chainId: string
    }

export async function getTx(txhash: string): Promise<FcdTx | undefined> {
  const mempoolItem = Mempool.getTransactionByHash(txhash)

  if (mempoolItem) {
    return {
      height: '',
      txhash: mempoolItem.txhash,
      tx: mempoolItem.lcdTx,
      timestamp: new Date(mempoolItem.firstSeenAt).toISOString(),
      chainId: config.CHAIN_ID
    }
  }

  const qb = getRepository(TxEntity)
    .createQueryBuilder()
    .where('hash=lower(:txhash) OR hash=upper(:txhash) ', { txhash })

  const tx = await qb.getOne()
  return tx?.data && { ...(tx.data as Transaction.LcdTransaction), chainId: tx.chainId }
}
