import { getRepository } from 'typeorm'
import { RichListEntity } from 'orm'

export async function getRichList(denom: string): Promise<RichListEntity[]> {
  return getRepository(RichListEntity).find({
    select: ['account', 'amount', 'percentage'],
    where: {
      denom
    },
    order: {
      amount: 'DESC'
    }
  })
}
