import * as Bluebird from 'bluebird'
import * as lcd from 'lib/lcd'

function detectProposals(txs: Transaction.LcdTx[]) {
  txs.forEach((tx) => {
    console.log(JSON.stringify(tx, null, 2))
  })
}

async function main() {
  const { block } = await lcd.getBlock('3012946')

  const msgs = await Bluebird.map(block.data.txs, (tx, idx) => {
    try {
      return lcd.decodeTx(tx)
    } catch (err) {
      console.log('index:', idx, tx)
      console.error(err)
      return {} as Transaction.LcdTx
    }
  })

  detectProposals(msgs)
}

main().catch(console.error)
