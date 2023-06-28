import { getRepository, SelectQueryBuilder } from 'typeorm'
import { BlockEntity } from 'orm'
import { omit } from 'lodash'
import { getValidator } from 'lib/lcd'
import { APIError, ErrorTypes } from 'lib/error'

type GetBlockResponse =
  | (Pick<BlockEntity, 'chainId' | 'height' | 'timestamp'> & {
      proposer?: {
        moniker: string
        identity: string
        operatorAddress: string
      }
      txs: ({ id: number } & Transaction.LcdTransaction)[]
    })
  | null

export async function getBlock(height: number): Promise<GetBlockResponse> {
  let qb: SelectQueryBuilder<BlockEntity>
  if (height == 0) {
    qb = await getRepository(BlockEntity)
      .createQueryBuilder('block')
      .leftJoinAndSelect('block.txs', 'txs')
      .orderBy('block.id', 'DESC')
      .limit(1)
  } else {
    qb = await getRepository(BlockEntity)
      .createQueryBuilder('block')
      .where('block.height = :height', {
        height
      })
      .leftJoinAndSelect('block.txs', 'txs')
      .orderBy('txs.id')
  }

  const block = await qb.getOne()

  if (!block) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR)
  }

  const val = await getValidator(block.proposer)

  return {
    ...omit(block, ['id', 'reward', 'txs', 'proposer']),
    proposer: val && {
      moniker: val.description.moniker || '',
      identity: val.description.identity || '',
      operatorAddress: block.proposer
    },
    txs: block.txs.map((item) => ({ id: item.id, ...item.data }))
  }
}
