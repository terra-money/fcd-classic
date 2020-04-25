import * as nodeCron from 'node-cron'
import { init as initORM } from 'orm'

import { collectorLogger as logger } from 'lib/logger'
import { initializeSentry } from 'lib/errorReporting'
import setRichList from './richlist'
import setUnvested from './unvested'

const jobs = [
  {
    method: setRichList,
    cron: '1 1 */1 * * *'
  },
  {
    method: setUnvested,
    cron: '1 1 */1 * * *'
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
