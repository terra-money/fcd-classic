import { getRepository } from 'typeorm'

import { ValidatorInfoEntity } from 'orm'

import memoizeCache from 'lib/memoizeCache'

interface AccountInfo {
  accountAddress: string
  operatorAddress?: string
  moniker?: string
}

/**
 * Returns account address with optional validator info
 * @param {string} accountAddress - Terra account address
 * @returns {AccountInfo} result - Account Info
 */
async function getAccountInfoUncached(accountAddress: string): Promise<AccountInfo> {
  const validator = await getRepository(ValidatorInfoEntity).findOne({
    accountAddress
  })

  return {
    accountAddress,
    ...(validator && {
      operatorAddress: validator.operatorAddress,
      moniker: validator.moniker
    })
  }
}

const getAccountInfo = memoizeCache(getAccountInfoUncached, { promise: true, maxAge: 3600 * 1000 /* 1 hour */ })

export default getAccountInfo
