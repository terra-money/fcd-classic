import { get } from 'lodash'
import { plus, minus, times } from 'lib/math'
import config from 'config'
import { getDelegationTxs } from './getDelegationTxs'
import { ONE_DAY_IN_MS } from 'lib/constant'
import memoizeCache from 'lib/memoizeCache'

export async function getAvgVotingPowerUncached(
  validator: LcdValidator,
  fromTs: number,
  toTs: number,
  votingPowerNow: string
): Promise<string | undefined> {
  const { events } = await getDelegationTxs({
    operatorAddr: validator.operator_address,
    from: fromTs,
    to: toTs + ONE_DAY_IN_MS
  })

  const delegationBetweenRange = events.filter((ev) => new Date(ev.timestamp).getTime() < toTs)

  const delegationEventsAfterToday = events.filter((ev) => new Date(ev.timestamp).getTime() >= toTs)

  const votingPowerAtEndTime = delegationEventsAfterToday.reduce((acc, event) => {
    const eventAmount = get(event, 'amount.amount')

    if (!eventAmount) {
      return acc
    }

    return minus(acc, eventAmount)
  }, votingPowerNow)

  const tsRange = toTs - fromTs

  if (delegationBetweenRange.length === 0) {
    return votingPowerAtEndTime
  }

  delegationBetweenRange.push({
    id: 0,
    chainId: config.CHAIN_ID,
    txhash: '',
    height: '', // TODO: remove
    type: 'Delegate',
    amount: { denom: 'uluna', amount: '0' },
    timestamp: new Date(fromTs).toISOString()
  })

  const weightedSumObj = delegationBetweenRange.reduce(
    (acc, item) => {
      const tsDelta = acc.prevTs - new Date(item.timestamp).getTime()
      const weight = tsDelta / tsRange
      const amountDelta = get(item, 'amount.amount')

      if (!amountDelta) {
        return acc
      }

      const weightedSum = plus(acc.weightedSum, times(weight, acc.prevAmount))

      return {
        prevAmount: minus(acc.prevAmount, amountDelta),
        prevTs: new Date(item.timestamp).getTime(),
        weightedSum
      }
    },
    { prevAmount: votingPowerAtEndTime, weightedSum: '0', prevTs: toTs }
  )

  return weightedSumObj.weightedSum
}

export const getAvgVotingPower = memoizeCache(getAvgVotingPowerUncached, { promise: true, maxAge: 60 * 60 * 1000 })
