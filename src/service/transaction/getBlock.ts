import { getRepository } from 'typeorm'
import { BlockEntity, ValidatorInfoEntity } from 'orm'
import { omit } from 'lodash'

type GetBlockResponse =
  | (Pick<BlockEntity, 'chainId' | 'height' | 'timestamp'> & {
      proposer: {
        moniker: string
        operatorAddress: string
      }
      txs: ({ id: number } & Transaction.LcdTransaction)[]
    })
  | null

export async function getBlock(chainId: string, height: number): Promise<GetBlockResponse> {
  const qb = await getRepository(BlockEntity)
    .createQueryBuilder('block')
    .where('block.height = :height AND block.chainId = :chainId', {
      height,
      chainId
    })

  qb.leftJoinAndSelect('block.txs', 'txs')
  qb.orderBy('txs.id')

  const block = await qb.getOne()

  if (!block) {
    return null
  }

  const val = await getRepository(ValidatorInfoEntity).findOne({ operatorAddress: block.proposer })

  return {
    ...omit(block, ['id', 'reward', 'txs', 'proposer']),
    proposer: {
      moniker: val ? val.moniker : '',
      operatorAddress: block.proposer
    },
    txs: block.txs.map((item) => ({ id: item.id, ...item.data }))
  }
}
