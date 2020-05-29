import * as lcd from 'lib/lcd'

import { getTxHashesFromBlock } from 'collector/block'

function timeReporter(startTime: number, task: string): number {
  const timeElapsed = (new Date().getTime() - startTime) / 1000

  console.log(`Time: ${timeElapsed} sec - Task: ${task}`)

  return new Date().getTime()
}

async function blockExplorer() {
  const startTime = new Date().getTime()
  let prevTime = startTime

  const blockHeight = process.argv.length >= 3 ? process.argv[2] : undefined
  if (!blockHeight) {
    throw new Error('Pass block height argument')
  }
  console.log(`Exploring block ${blockHeight}`)

  const block = await lcd.getBlock(Number(blockHeight))

  prevTime = timeReporter(prevTime, 'Getting block info')

  const txHashes = getTxHashesFromBlock(block)
  console.log(`Total tx ${txHashes.length}`)

  for (const hash of txHashes) {
    try {
      const tx = await lcd.getTx(hash)
      console.log(`Got tx ${tx?.txhash}`)
    } catch (error) {
      console.log(`Failed to get tx ${hash}`)
    }
  }

  prevTime = timeReporter(prevTime, 'Getting txs one by one')

  console.log('\n\nGetting txs using Promise.all')
  await Promise.all(txHashes.map((hash) => lcd.getTx(hash)))

  prevTime = timeReporter(prevTime, 'Getting txs using promise.all')

  console.log('\n\nExploring block is done')

  timeReporter(startTime, 'Explore whole block infos')
}

blockExplorer().catch((error) => {
  console.error(error)
})
