import { init as initORM, TxEntity } from 'orm'
import { getRepository } from 'typeorm'
import { get } from 'lodash'
import { getQueryDateTime } from 'lib/time'
import { getSwapCoinAndFee } from 'service/transaction'

function getSwapResult({ data }) {
  const logs = get(data, 'logs')
  const msgs = get(data, 'tx.value.msg')

  if (!logs || !msgs) {
    return
  }

  msgs.map(({ type, value }, i) => {
    if (type !== 'market/MsgSwap') {
      return
    }

    if (logs[i].log.code) {
      return
    }

    const { swapCoin, swapFee } = getSwapCoinAndFee(logs[i])
    const offerCoin = value.offer_coin
    const trader = value.trader

    const askAmount = Number(swapCoin.split('u')[0]) / 1000000
    const swapFeeAmount = Number(swapFee.split('u')[0]) / 1000000
    const askDenom = value.ask_denom.slice(1)

    const offerAmount = Number(offerCoin.amount) / 1000000
    const offerDenom = offerCoin.denom.slice(1)
    const timeStr = getQueryDateTime(data.timestamp)

    console.log(
      `${timeStr},${trader},${data.txhash},${offerAmount},${offerDenom},${askAmount},${askDenom},${swapFeeAmount},${askDenom}`
    )
  })
}

async function main() {
  await initORM()

  const qb = getRepository(TxEntity).createQueryBuilder('tx').select(`tx.data`)
  qb.andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "market/MsgSwap"}]'`)
  qb.take(100)

  const txs = await qb.getMany()
  txs.forEach(getSwapResult)
}

main().catch(console.error)
