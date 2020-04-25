export * from './proposalBasic'
export * from './voteSummary'

import { get } from 'lodash'
import * as memoizee from 'memoizee'

import * as lcd from 'lib/lcd'
import { convertAccAddressToValAddress } from 'lib/common'

async function getAccountInfoUncached(
  accAddress: string
): Promise<{
  accountAddress: string
  operatorAddress?: string
  moniker?: string
}> {
  const valAddr = convertAccAddressToValAddress(accAddress)
  const validator = await lcd.getValidator(valAddr)

  const result = {
    accountAddress: accAddress
  }

  if (validator) {
    return {
      ...result,
      operatorAddress: valAddr,
      moniker: get(validator, 'description.moniker')
    }
  }

  return result
}

export const getAccountInfo = memoizee(getAccountInfoUncached, { promise: true, maxAge: 60 * 60000 })
