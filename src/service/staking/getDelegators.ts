import { orderBy, drop, take } from 'lodash'
import { div, plus } from 'lib/math'
import * as lcd from 'lib/lcd'

export interface Delegator {
  address: string
  amount: string
  weight: string
}

interface GetDelegatorPaginatedResult {
  totalCnt: number // total delegator
  page: number //  page number
  limit: number //  page count limit
  delegators: Delegator[]
}

export async function getDelegators(operatorAddr: string): Promise<Delegator[]> {
  const delegations = await lcd.getValidatorDelegations(operatorAddr)
  const delegateTotal = delegations.reduce((acc, curr) => plus(acc, curr.shares), '0')

  return orderBy(
    delegations.map((d) => ({
      address: d.delegator_address,
      amount: d.shares,
      weight: div(d.shares, delegateTotal)
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
