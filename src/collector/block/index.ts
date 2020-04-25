export * from './block'
export * from './tx'
export * from './accountTx'

import { getRepository, MoreThan } from 'typeorm'
import { TxEntity, AccountTxEntity } from 'orm'

async function getRecentlySyncedTx(): Promise<number> {
  const latestSynced = await getRepository(AccountTxEntity).find({
    order: {
      id: 'DESC'
    },
    take: 1
  })

  if (!latestSynced || latestSynced.length === 0) {
    return 0
  }

  const latestSyncedTx = await getRepository(TxEntity).findOne({
    hash: latestSynced[0].hash
  })

  return latestSyncedTx ? latestSyncedTx.id : 0
}

export async function getTargetTx(tx?: TxEntity): Promise<TxEntity | undefined> {
  const recentlySyncedTxNumber = tx ? tx.id : await getRecentlySyncedTx()
  const targetTxs = await getRepository(TxEntity).find({
    where: {
      id: MoreThan(recentlySyncedTxNumber)
    },
    order: {
      id: 'ASC'
    },
    take: 1
  })

  return targetTxs[0]
}
