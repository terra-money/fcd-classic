import * as lcd from 'lib/lcd'
import { unmarshalTx, Tx } from '@terra-money/amino-js'

function detectProposals(txs: Tx[]) {
  txs.forEach(tx => {
    console.log(JSON.stringify(tx, null, 2))
  })
}

async function main() {
  const { block } = await lcd.getBlock('1905252')

  const txs = block.data.txs.map((tx, idx) => {
    try {
      return unmarshalTx(Buffer.from(tx, 'base64'))
    } catch (err) {
      console.log('index:', idx, tx);
      console.error(err)
      return {} as Tx
    }
  })

  detectProposals(txs);
}

main().catch(console.error)