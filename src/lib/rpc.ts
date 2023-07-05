import { compact } from 'lodash'
import config from 'config'
import { request } from 'lib/request'
import { apiLogger as logger } from './logger'

async function fetch(path: string, params?: Record<string, string>): Promise<any> {
  const url = `${config.RPC_URI}${path}`
  const response = await request(url, params)
    .then((res) => {
      if (res.statusCode !== 200) {
        throw new Error('invalid status')
      }

      return res.body.json()
    })
    .catch((e) => {
      const isSuppress = e instanceof TypeError || e instanceof SyntaxError

      if (!isSuppress) {
        logger.error(`RPC request to ${url} failed by ${e}`)
      }
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

export async function fetchRewards(height: string): Promise<Reward[]> {
  const blockResult = await fetch(`/block_results`, { height })

  if (!blockResult) {
    throw new Error('failed get block results from rpc')
  }

  const events = [...(blockResult.begin_block_events || []), ...(blockResult.end_block_events || [])]

  events.forEach((event) => {
    event.attributes.forEach((attr) => {
      attr.key = base64Decode(attr.key)
      attr.value = base64Decode(attr.value)
    })
  })

  const decodedRewardsAndCommission: Reward[] = compact(
    (events || [])
      .map((event) => {
        if (event.type !== 'rewards' && event.type !== 'commission') {
          return
        }

        const res = {
          type: event.type
        }

        event.attributes.forEach((attr) => {
          res[attr.key] = attr.value
        })

        if (res['amount'] === null) {
          return
        }

        return res as Reward
      })
      .flat()
  )

  return decodedRewardsAndCommission
}

export async function fetchUnconfirmedTxs(
  params: Record<string, string> = { limit: '1000000000000' }
): Promise<string[]> {
  const unconfirmedTxs = await fetch(`/unconfirmed_txs`, params)

  if (!Array.isArray(unconfirmedTxs.txs)) {
    throw new Error('unconfirmed txs not found')
  }

  return unconfirmedTxs.txs
}
