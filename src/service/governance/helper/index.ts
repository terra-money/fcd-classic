export * from './proposalBasic'
export * from './voteSummary'

import * as memoizee from 'memoizee'
import { getRepository } from 'typeorm'

import { ValidatorInfoEntity } from 'orm'

async function getAccountInfoUncached(
  accAddress: string
): Promise<{
  accountAddress: string
  operatorAddress?: string
  moniker?: string
}> {
  const validator = await getRepository(ValidatorInfoEntity).findOne({
    accountAddress: accAddress
  })

  const result = {
    accountAddress: accAddress
  }

  if (validator) {
    return {
      ...result,
      operatorAddress: validator.operatorAddress,
      moniker: validator.moniker
    }
  }

  return result
}

export const getAccountInfo = memoizee(getAccountInfoUncached, { promise: true, maxAge: 3600 * 1000 /* 1 hour */ })
