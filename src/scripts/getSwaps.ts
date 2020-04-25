import { init as initORM, AccountTxEntity } from 'orm'
import { getRepository } from 'typeorm'
import { get } from 'lodash'
import * as moment from 'moment'

function getSwapResult(data) {
  const logs = get(data, 'logs')
  const msgs = get(data, 'tx.value.msg')

  if (!logs || !msgs) {
    return
  }

  msgs.map((msg, i) => {
    if (msg.type !== 'market/MsgSwap') {
      return
    }

    if (logs[i].log.code) {
      return
    }

    const swapFee = get(logs[i], 'log.swap_fee')
    const swapCoin = get(logs[i], 'log.swap_coin')
    const offerCoin = get(msg, 'value.offer_coin')
    const trader = get(msg, 'value.trader')

    const askAmount = Number(swapCoin.split('u')[0]) / 1000000
    const swapFeeAmount = Number(swapFee.split('u')[0]) / 1000000
    const askDenom = get(msg, 'value.ask_denom').slice(1)

    const offerAmount = Number(offerCoin.amount) / 1000000
    const offerDenom = offerCoin.denom.slice(1)
    const timeStr = moment(data.timestamp).format('YYYY-MM-DD HH:mm:ss')

    console.log(
      `${timeStr},${trader},${data.txhash},${offerAmount},${offerDenom},${askAmount},${askDenom},${swapFeeAmount},${askDenom}`
    )
  })
}

async function main() {
  await initORM()

  const swapTxs = await getRepository(AccountTxEntity).find({
    where: {
      type: 'swap'
    },
    order: {
      timestamp: 'ASC'
    },
    relations: ['tx']
  })

  for (let i = 0; i < swapTxs.length; i = i + 1) {
    getSwapResult(swapTxs[i].tx.data)
  }
}

main().catch(console.error)
