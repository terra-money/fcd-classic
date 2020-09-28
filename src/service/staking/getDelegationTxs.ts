import { get, flatten, take, drop, compact } from 'lodash'

import { isSuccessfulTx } from 'lib/tx'

import { getRawDelegationTxs } from './helper'

export interface GetDelegationEventsParam {
  operatorAddr: string // operator address
  limit: number // tx count limit per page
  page: number // tx count of pagination
  from?: string // datetime
  to?: string // datetime
}

function eventMapper(height: string, valOpAddr: string, timestamp) {
  return (msg): GetDelegationEventsReturn | undefined => {
    switch (msg.type) {
      case 'staking/MsgDelegate': {
        if (get(msg, 'value.validator_address') !== valOpAddr) {
          return undefined
        }

        const type = 'Delegate'
        const amount = {
          denom: get(msg, 'value.amount.denom'),
          amount: get(msg, 'value.amount.amount')
        }
        return { height, type, amount, timestamp }
      }
      case 'staking/MsgCreateValidator': {
        if (get(msg, 'value.validator_address') !== valOpAddr) {
          return undefined
        }

        const type = 'Create Validator'
        const amount = {
          denom: get(msg, 'value.value.denom'),
          amount: get(msg, 'value.value.amount')
        }
        return { height, type, amount, timestamp }
      }
      case 'staking/MsgBeginRedelegate': {
        const srcAddr = get(msg, 'value.validator_src_address')
        const dstAddr = get(msg, 'value.validator_dst_address')
        if (srcAddr !== valOpAddr && dstAddr !== valOpAddr) {
          return undefined
        }

        const type = 'Redelegate'
        let amt = get(msg, 'value.amount.amount')

        if (srcAddr === valOpAddr && amt) {
          amt = `-${amt}`
        }

        const amount = {
          denom: 'uluna',
          amount: amt
        }
        return { height, type, amount, timestamp }
      }
      case 'staking/MsgUndelegate': {
        if (get(msg, 'value.validator_address') !== valOpAddr) {
          return undefined
        }

        const type = 'Undelegate'
        const amount = {
          denom: get(msg, 'value.amount.denom'),
          amount: `-${get(msg, 'value.amount.amount')}`
        }
        return { height, type, amount, timestamp }
      }
      default: {
        return undefined
      }
    }
  }
}

export default async function getDelegationTxs(data: GetDelegationEventsParam): Promise<DelegationTxsReturn> {
  const rawTxs = await getRawDelegationTxs(data)

  const result = rawTxs.txs
    .filter((tx: Transaction.LcdTransaction) => {
      return isSuccessfulTx(tx)
    })
    .map((tx: any) => {
      const msgs = get(tx, 'tx.value.msg')
      return msgs.map(eventMapper(tx.height, data.operatorAddr, tx.timestamp))
    })
  const events: GetDelegationEventsReturn[] = compact(flatten(result))

  return {
    totalCnt: events.length,
    page: data.page,
    limit: data.limit,
    events: take(drop(events, (data.page - 1) * data.limit), data.limit)
  }
}
