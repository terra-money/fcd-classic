import { getDelegators } from './helper'
import { chain } from 'lodash'

export interface GetDelegatorsParam {
  operatorAddr: string
  limit: number
  page: number
}

interface GetDelegatorReturn {
  totalCnt: number // total delegator
  page: number //  page number
  limit: number //  page count limit
  delegators: Delegator[]
}

export default async function delegators(data: GetDelegatorsParam): Promise<GetDelegatorReturn> {
  const rawDelegators = await getDelegators(data.operatorAddr)

  const delegators: Delegator[] = chain(rawDelegators)
    .orderBy([(d) => Number(d.weight)], ['desc'])
    .drop((data.page - 1) * data.limit)
    .take(data.limit)
    .value()

  return {
    totalCnt: rawDelegators.length,
    page: data.page,
    limit: data.limit,
    delegators
  }
}
