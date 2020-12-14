import { getRepository } from 'typeorm'
import { UnvestedEntity } from 'orm'
import { minus, div } from 'lib/math'
import { currencyToDenom, isActiveCurrency } from 'lib/common'
import { getTotalSupply } from './totalSupply'
import { isToken, getCirculatingSupply as getTokenCirculatingSupply } from './token'

export async function getCirculatingSupply(input: string): Promise<string> {
  if (isToken(input)) {
    return getTokenCirculatingSupply(input)
  }

  const denom = isActiveCurrency(input) ? currencyToDenom(input.toLowerCase()) : input
  const totalSupply = await getTotalSupply(denom)
  const unvested = await getRepository(UnvestedEntity).find({
    where: {
      denom
    },
    order: {
      id: 'DESC'
    },
    take: 1
  })

  const circulatingSupply = unvested.length === 0 ? totalSupply : minus(totalSupply, unvested[0].amount)

  return input !== denom ? div(circulatingSupply, 1000000) : circulatingSupply
}
