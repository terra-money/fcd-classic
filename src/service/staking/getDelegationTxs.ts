import { get } from 'lodash'
import { isSuccessfulTx } from 'lib/tx'
import { getRawDelegationTxs } from './helper'

interface GetDelegationEventsParam {
  operatorAddr: string // operator address
  limit?: number // tx count limit per page
  offset?: number // for pagination
}

interface GetDelegationEventsReturn {
  id: number
  chainId: string
  height: string // TODO: remove
  txhash: string
  type: string
  amount: Coin
  timestamp: string
}

interface DelegationTxsReturn {
  events: GetDelegationEventsReturn[]
  next?: number
  limit?: number // tx count per page
}

function extractEvents(
  tx: Transaction.LcdTransaction & { id: number; chainId: string },
  valOpAddr: string
): GetDelegationEventsReturn[] {
  const msgs = get(tx, 'tx.value.msg')
  const { id, chainId, height, timestamp, txhash } = tx

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
        return { id, chainId, height, txhash, type, amount, timestamp }
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
        return { id, chainId, height, txhash, type, amount, timestamp }
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
        return { id, chainId, height, txhash, type, amount, timestamp }
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
        return { id, chainId, height, txhash, type, amount, timestamp }
      }
      default: {
        return undefined
      }
    }
  })
}

export async function getDelegationTxs(param: GetDelegationEventsParam): Promise<DelegationTxsReturn> {
  const { next, txs } = await getRawDelegationTxs(param)

  const events = txs
    .filter(isSuccessfulTx)
    .map((tx) => extractEvents(tx, param.operatorAddr))
    .flat()
    .filter(Boolean)

  return {
    next,
    limit: param.limit,
    events
  }
}
