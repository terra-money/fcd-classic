import * as nodeCron from 'node-cron'
import { init as initORM } from 'orm'

import { collectorLogger as logger } from 'lib/logger'
import { initializeSentry } from 'lib/errorReporting'
import { saveRichList } from './richlist'
import { saveUnvested } from './unvested'

const jobs = [
  {
    method: saveRichList,
    cron: '0 13 * * *'
  },
  {
    method: saveUnvested,
    cron: '0 13 * * *'
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
