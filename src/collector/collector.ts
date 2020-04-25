import { init as initORM } from 'orm'
import * as nodeCron from 'node-cron'
import { get } from 'lodash'

import { collectorLogger as logger } from 'lib/logger'
import { initializeSentry } from 'lib/errorReporting'
import { saveLatestBlock } from './block'
import { setPrices } from './price'
import { setGeneral } from './general'
import cacheStakingReward from './cacheStakingReward'
import Semaphore from './Semaphore'

process.on('unhandledRejection', (err) => {
  logger.error({
    type: 'SYSTEM_ERROR',
    message: get(err, 'message'),
    stack: get(err, 'stack')
  })
})

const blockExplorer = new Semaphore('BlockExplorer', saveLatestBlock, logger)
const priceExplorer = new Semaphore('PriceExplorer', setPrices, logger)
const genInfoExplorer = new Semaphore('GenInfoExplorer', setGeneral, logger)
const cacheManager = new Semaphore('CachingManager', cacheStakingReward, logger)

const jobs = [
  {
    method: blockExplorer.run.bind(blockExplorer),
    cron: '*/1 * * * * *'
  },
  {
    method: priceExplorer.run.bind(priceExplorer),
    cron: '50 * * * * *'
  },
  {
    method: genInfoExplorer.run.bind(genInfoExplorer),
    cron: '1 * * * * *'
  },
  {
    method: cacheManager.run.bind(cacheManager),
    cron: '*/30 * * * *'
  }
]

async function createJobs() {
  for (const job of jobs) {
    nodeCron.schedule(job.cron, job.method)
  }
}

const init = async () => {
  await initORM()

  initializeSentry()
}

init()
  .then(() => {
    createJobs().catch((err) => {
      logger.error(err)
    })
  })
  .catch(logger.error)
