import * as rp from 'request-promise'
import { compact, get } from 'lodash'
import config from 'config'
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

interface Reward {
  amount: string // '183373.654531179990300676ukrw'
  validator: string // 'terravaloper1nwrksgv2vuadma8ygs8rhwffu2ygk4j24w2mku'
  type: 'proposer_reward' | 'rewards' | 'commission'
}

export async function getRewards(height: number): Promise<Reward[]> {
  const blockResult = await getRequest(`/block_results`, { height })

  if (!blockResult || !blockResult.result) {
    throw new Error('failed get block results from rpc')
  }

  const result = blockResult.result
  const events = result.results
    ? result.results.begin_block.events // columbus-1 to 3
    : result.begin_block_events // columbus-4

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
