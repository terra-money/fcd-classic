import { orderBy, drop, take } from 'lodash'
import { div, plus } from 'lib/math'
import * as rp from 'request-promise'
import config from 'config'

interface GetDelegatorPaginatedResult {
  totalCnt: number // total delegator
  page: number //  page number
  limit: number //  page count limit
  delegators: Delegator[]
}

interface MantleDelegations {
  DelegatorAddress: string
  Shares: string
  ValidatorAddress: string
}

const protocol = require(config.MANTLE_URI.startsWith('https') ? 'https' : 'http')
const agent = new protocol.Agent({
  rejectUnauthorized: false,
  keepAlive: true
})

function getDelegationsFromMantle(operatorAddr: string): Promise<MantleDelegations[]> {
  return rp(config.MANTLE_URI, {
    method: 'POST',
    body: {
      operationName: null,
      query: `{
        StakingValidatorsValidatorAddrDelegations(ValidatorAddr: "${operatorAddr}") {
          Height
          Result {
            DelegatorAddress
            ValidatorAddress
            Shares
          }
        }
      }`,
      variables: {}
    },
    json: true,
    agent
  }).then((res) => {
    if (res.errors) {
      console.error(res.errors)
      throw new Error('mantle query error')
    }

    return res?.data?.StakingValidatorsValidatorAddrDelegations?.Result || []
  })
}

export async function getDelegators(operatorAddr: string): Promise<Delegator[]> {
  const delegations = await getDelegationsFromMantle(operatorAddr)
  const delegateTotal = delegations.reduce((acc, curr) => plus(acc, curr.Shares), '0')

  return orderBy(
    delegations.map((d) => ({
      address: d.DelegatorAddress,
      amount: d.Shares,
      weight: div(d.Shares, delegateTotal)
    })),
    [(d) => Number(d.weight)],
    ['desc']
  )
}

export async function getPaginatedDelegators(
  operatorAddr: string,
  page: number,
  limit: number
): Promise<GetDelegatorPaginatedResult> {
  const delegations = await getDelegators(operatorAddr)

  return {
    totalCnt: delegations.length,
    page,
    limit,
    delegators: take(drop(delegations, (page - 1) * limit), limit)
  }
}
