import { get, flatten, compact } from 'lodash'
import { isSuccessfulTx } from 'lib/tx'
import { getRawDelegationTxs } from './helper'

export interface GetDelegationEventsParam {
  operatorAddr: string // operator address
  limit: number // tx count limit per page
  page: number // tx count of pagination
  from?: string // datetime
  to?: string // datetime
}

interface GetDelegationEventsReturn {
  chainId: string
  height: string // TODO: remove
  txhash: string
  type: string
  amount: Coin
  timestamp: string
}

interface DelegationTxsReturn {
  totalCnt: number // total tx
  page: number // tx page no of pagination
  limit: number // tx count per page
  events: GetDelegationEventsReturn[]
}

function extractEvents(
  tx: Transaction.LcdTransaction & { chainId: string },
  valOpAddr: string
): GetDelegationEventsReturn[] {
  const msgs = get(tx, 'tx.value.msg')
  const { chainId, height, timestamp, txhash } = tx

  return msgs.map((msg): GetDelegationEventsReturn | undefined => {
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
        return { chainId, height, txhash, type, amount, timestamp }
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
        return { chainId, height, txhash, type, amount, timestamp }
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
        return { chainId, height, txhash, type, amount, timestamp }
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
        return { chainId, height, txhash, type, amount, timestamp }
      }
      default: {
        return undefined
      }
    }
  })
}

export default async function getDelegationTxs(data: GetDelegationEventsParam): Promise<DelegationTxsReturn> {
  const rawTxs = await getRawDelegationTxs(data)
  const events = compact(flatten(rawTxs.txs.filter(isSuccessfulTx).map((tx) => extractEvents(tx, data.operatorAddr))))

  return {
    totalCnt: rawTxs.totalCnt,
    page: data.page,
    limit: data.limit,
    events
  }
}
