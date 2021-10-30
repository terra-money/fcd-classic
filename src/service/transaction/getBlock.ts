import { getRepository } from 'typeorm'
import { BlockEntity, ValidatorInfoEntity } from 'orm'
import { omit } from 'lodash'

type GetBlockResponse =
  | (Pick<BlockEntity, 'chainId' | 'height' | 'timestamp'> & {
      proposer: {
        moniker: string
        identity: string
        operatorAddress: string
      }
      txs: ({ id: number } & Transaction.LcdTransaction)[]
    })
  | null

export async function getBlock(height: number): Promise<GetBlockResponse> {
  const qb = await getRepository(BlockEntity)
    .createQueryBuilder('block')
    .where('block.height = :height', {
      height
    })
    .leftJoinAndSelect('block.txs', 'txs')
    .orderBy('block.id', 'DESC')
    .addOrderBy('txs.id')

  const block = await qb.getOne()

  if (!block) {
    return null
  }

  const val = await getRepository(ValidatorInfoEntity).findOne({ operatorAddress: block.proposer })

  return {
    ...omit(block, ['id', 'reward', 'txs', 'proposer']),
    proposer: {
      moniker: val ? val.moniker : '',
      identity: val ? val.identity : '',
      operatorAddress: block.proposer
    },
    txs: block.txs.map((item) => ({ id: item.id, ...item.data }))
  }
}
