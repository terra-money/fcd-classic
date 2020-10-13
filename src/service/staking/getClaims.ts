import { get, flatten, filter, compact } from 'lodash'

import { TxEntity } from 'orm'

import { sortDenoms, splitDenomAndAmount } from 'lib/common'
import { getClaimTxs } from './helper'

export interface GetClaimsParam {
  operatorAddr: string
  limit: number
  page: number
}

interface DelegationClaim {
  tx: string // tx hash of clain
  type: string // tx types like reward, commission
  amounts: Coin[] // amounts in with their denoms
  timestamp: string // tx timestamp
}

function getClaimFromCol2(tx) {
  const tags = get(tx, 'data.tags')
  if (!tags) {
    return []
  }

  const msgs = get(tx, 'data.tx.value.msg')
  let tagIndex = 0
  return (
    msgs &&
    msgs.map((msg) => {
      const msgType = get(msg, 'type')

      let type: string
      let amounts: Coin[]

      if (msgType === 'cosmos-sdk/MsgWithdrawValidatorCommission') {
        // columbus-1
        type = 'Commission'
        amounts = []
      } else if (msgType === 'cosmos-sdk/MsgWithdrawDelegationReward') {
        // columbus-1
        type = 'Reward'
        amounts = []
      } else if (msgType === 'distribution/MsgWithdrawValidatorCommission') {
        // columbus-2
        type = 'Commission'
        amounts = get(tags, `[${tagIndex + 1}].value`, '')
          .split(',')
          .map(splitDenomAndAmount)
        tagIndex += 3
      } else if (msgType === 'distribution/MsgWithdrawDelegationReward') {
        // columbus-2
        type = 'Reward'
        amounts = get(tags, `[${tagIndex + 1}].value`, '')
          .split(',')
          .map(splitDenomAndAmount)
        tagIndex += 4
      } else {
        return null
      }

      return {
        tx: tx.data['txhash'],
        type,
        amounts: sortDenoms(amounts),
        timestamp: tx.data['timestamp']
      }
    })
  )
}

function getMsgsFromTxs(txs: TxEntity[]): DelegationClaim[] {
  return compact(
    flatten(
      txs.map((tx) => {
        if (get(tx, 'data.tags')) {
          return getClaimFromCol2(tx)
        }

        const msgs = get(tx, 'data.tx.value.msg')
        return (
          msgs &&
          msgs.map((msg, i: number) => {
            const msgType = get(msg, 'type')
            const events = get(tx, `data.logs.${i}.events`)

            let type: string
            let amounts: Coin[]

            if (msgType === 'distribution/MsgWithdrawValidatorCommission') {
              type = 'Commission'

              const withdrawEvents = filter(events, { type: 'withdraw_commission' })
              if (!withdrawEvents || withdrawEvents.length === 0) {
                return null
              }
              const amountStr = get(withdrawEvents[0], 'attributes.0.value', '')
              amounts = amountStr.split(',').map(splitDenomAndAmount)
            } else if (msgType === 'distribution/MsgWithdrawDelegationReward') {
              type = 'Reward'
              const withdrawEvents = filter(events, { type: 'withdraw_rewards' })
              if (!withdrawEvents || withdrawEvents.length === 0) {
                return null
              }
              const amountStr = get(withdrawEvents[0], 'attributes.0.value', '')
              amounts = amountStr.split(',').map(splitDenomAndAmount)
            } else {
              return null
            }

            return {
              tx: tx.data['txhash'],
              type,
              amounts: sortDenoms(amounts),
              timestamp: tx.data['timestamp']
            }
          })
        )
      })
    )
  )
}

interface ClaimTxReturn {
  totalCnt: number
  page: number
  limit: number
  claims: DelegationClaim[]
}

export default async function getClaims(data: GetClaimsParam): Promise<ClaimTxReturn> {
  const { totalCnt, txs } = await getClaimTxs(data)

  return {
    totalCnt,
    page: data.page,
    limit: data.limit,
    claims: getMsgsFromTxs(txs)
  }
}
