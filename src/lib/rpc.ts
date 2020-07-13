import * as rp from 'request-promise'
import { filter, compact, get } from 'lodash'

import config from 'config'

import { splitDenomAndAmount } from 'lib/common'
import { apiLogger as logger } from './logger'

async function getRequest(url: string, params?: object): Promise<any> {
  const options = {
    method: 'GET',
    rejectUnauthorized: false,
    headers: {
      'Content-Type': 'application/json'
    },
    qs: params,
    json: true
  }

  const result = await rp(`${config.RPC_URI}${url}`, options).catch((e) => {
    logger.error(`RPC request to ${url} failed by ${e}`)
  })
  return result
}

function base64Decode(data: string) {
  if (!data) {
    return data
  }

  const buff = Buffer.from(data, 'base64')
  return buff.toString('ascii')
}

export async function getTaxRateAndCap(
  height: string
): Promise<{
  tax_rate: string // 0.006750000000000000
  tax_caps: {
    [denom: string]: string
    // ukrw: '1638762092',
    // umnt: '3775004956',
    // usdr: '1000000',
    // uusd: '1375435'
  }
}> {
  const blockResult = await getRequest(`/block_results`, { height })

  if (!blockResult) {
    throw new Error('failed to get block results from rpc')
  }

  const beginBlock = blockResult.result.results.begin_block.events
  const treasury = filter(beginBlock, { type: 'treasury' })[0]

  if (!treasury) {
    throw new Error('failed to find treasury key from block results')
  }

  const decodedTreasury = treasury.attributes.map((attrs) => {
    const key = base64Decode(attrs.key)
    const value = base64Decode(attrs.value)
    return {
      key,
      value
    }
  })

  return decodedTreasury.reduce((acc, item) => {
    if (item.key === 'tax_caps' && item.value) {
      acc[item.key] = item.value.split(',').reduce((acc, cap) => {
        const { amount, denom } = splitDenomAndAmount(cap)
        acc[denom] = amount
        return acc
      }, {})
    } else {
      acc[item.key] = item.value
    }
    return acc
  }, {})
}

interface Reward {
  amount: string // '183373.654531179990300676ukrw'
  validator: string // 'terravaloper1nwrksgv2vuadma8ygs8rhwffu2ygk4j24w2mku'
  type: 'proposer_reward' | 'rewards' | 'commission'
}

export async function getRewards(height: number): Promise<Reward[]> {
  const blockResult = await getRequest(`/block_results`, { height })

  if (!blockResult) {
    throw new Error('failed get block results from rpc')
  }

  const events = get(blockResult, 'result.results.begin_block.events', [])
  const decodedRewardsAndCommission: Reward[] = compact(
    events.map((event) => {
      if (event.type !== 'proposer_reward' && event.type !== 'rewards' && event.type !== 'commission') {
        return
      }

      const res = {}

      event.attributes.forEach((attr) => {
        const key = base64Decode(attr.key)
        const value = base64Decode(attr.value)
        res[key] = value
      })

      res['type'] = event.type
      return res
    })
  )

  return decodedRewardsAndCommission
}
