import { request, Agent } from 'undici'
import { compact } from 'lodash'
import config from 'config'
import { apiLogger as logger } from './logger'

const agent = new Agent({
  connect: {
    rejectUnauthorized: false
  }
})

async function getRequest(path: string, params?: Record<string, string>): Promise<any> {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'terra-fcd'
    },
    dispatcher: agent
  }

  let url = `${config.RPC_URI}${path}`
  params && Object.keys(params).forEach((key) => params[key] === undefined && delete params[key])
  const qs = new URLSearchParams(params as any).toString()
  if (qs.length) {
    url += `?${qs}`
  }

  const response = await request(url, options)
    .then((res) => {
      if (res.statusCode !== 200) {
        throw new Error('invalid status')
      }

      return res.body.json()
    })
    .catch((e) => {
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
  amount: string // '183373.654531179990300676uluna'
  validator: string // 'terravaloper1nwrksgv2vuadma8ygs8rhwffu2ygk4j24w2mku'
  type: 'proposer_reward' | 'rewards' | 'commission'
}

export async function getRewards(height: string): Promise<Reward[]> {
  const blockResult = await getRequest(`/block_results`, { height })

  if (!blockResult) {
    throw new Error('failed get block results from rpc')
  }

  const events = [...(blockResult.begin_block_events || []), ...(blockResult.end_block_events || [])]

  const decodedRewardsAndCommission: Reward[] = compact(
    (events || [])
      .map((event) => {
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
        return res as Reward
      })
      .flat()
  )

  return decodedRewardsAndCommission
}

export async function getUnconfirmedTxs(
  params: Record<string, string> = { limit: '1000000000000' }
): Promise<string[]> {
  const unconfirmedTxs = await getRequest(`/unconfirmed_txs`, params)

  if (!Array.isArray(unconfirmedTxs.txs)) {
    throw new Error('unconfirmed txs not found')
  }

  return unconfirmedTxs.txs
}
