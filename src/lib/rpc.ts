import * as rp from 'request-promise'
import { compact } from 'lodash'
import config from 'config'
import { apiLogger as logger } from './logger'

async function getRequest(url: string, params?: Record<string, unknown>): Promise<any> {
  const options = {
    method: 'GET',
    rejectUnauthorized: false,
    headers: {
      'Content-Type': 'application/json'
    },
    qs: params,
    json: true
  }

  const response = await rp(`${config.RPC_URI}${url}`, options).catch((e) => {
    logger.error(`RPC request to ${url} failed by ${e}`)
  })

  if (!response || typeof response.jsonrpc !== 'string') {
    throw new Error('failed to query RPC')
  }

  return response.result
}

function base64Decode(data: string) {
  if (!data) {
    return data
  }

  const buff = Buffer.from(data, 'base64')
  return buff.toString('ascii')
}

interface Reward {
  amount: string // '183373.654531179990300676ukrw'
  validator: string // 'terravaloper1nwrksgv2vuadma8ygs8rhwffu2ygk4j24w2mku'
  type: 'proposer_reward' | 'rewards' | 'commission'
}

export async function getRewards(height: string): Promise<Reward[]> {
  const blockResult = await getRequest(`/block_results`, { height })

  if (!blockResult) {
    throw new Error('failed get block results from rpc')
  }

  const events = blockResult.results
    ? // columbus-1 to 3
      blockResult.results.begin_block.events
    : // columbus-4
      [...(blockResult.begin_block_events || []), ...(blockResult.end_block_events || [])]

  const decodedRewardsAndCommission: Reward[] = compact(
    (events || []).map((event) => {
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

export async function getUnconfirmedTxs(
  params: Record<string, unknown> = { limit: '1000000000000' }
): Promise<string[]> {
  const unconfirmedTxs = await getRequest(`/unconfirmed_txs`, params)

  if (!Array.isArray(unconfirmedTxs.txs)) {
    throw new Error('unconfirmed txs not found')
  }

  return unconfirmedTxs.txs
}
