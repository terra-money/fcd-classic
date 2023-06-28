import { init as initORM, ValidatorInfoEntity } from 'orm'
import * as nodeCron from 'node-cron'
import { get } from 'lodash'
import { default as parseDuration } from 'parse-duration'

import { collectorLogger as logger } from 'lib/logger'
import { init as initializeSentry } from 'lib/errorReport'
import { init as initToken } from 'service/treasury/token'

import { collectBlock } from './block'
import { collectValidatorReturn, collectValidator } from './staking'
import { collectDashboard } from './dashboard'
import { startWatcher, startPolling } from './watcher'
import { collectRichList } from './richlist'
import { collectUnvested } from './unvested'

import Semaphore from './Semaphore'
import { getRepository } from 'typeorm'

process.on('unhandledRejection', (err) => {
  logger.error({
    type: 'SYSTEM_ERROR',
    message: get(err, 'message'),
    stack: get(err, 'stack')
  })
})

const tenMinute = parseDuration('10m')
const twentyMinute = parseDuration('20m')

const validatorCollector = new Semaphore('ValidatorCollector', collectValidator, logger, tenMinute)
const returnCalculator = new Semaphore('ReturnCalculator', collectValidatorReturn, logger, twentyMinute)
const dashboardCollector = new Semaphore('DashboardCollector', collectDashboard, logger, twentyMinute)
const richListCollector = new Semaphore('RichListCollector', collectRichList, logger, twentyMinute)
const vestingCollector = new Semaphore('VestingCollector', collectUnvested, logger, twentyMinute)

const jobs = [
  // Per Hour
  {
    method: validatorCollector.run.bind(validatorCollector),
    cron: '30 1 * * * *'
  },
  // Per day
  {
    method: returnCalculator.run.bind(returnCalculator),
    cron: '0 10 0 * * *'
  },
  {
    method: dashboardCollector.run.bind(dashboardCollector),
    cron: '0 20 0 * * *'
  },
  {
    method: richListCollector.run.bind(richListCollector),
    cron: '0 0 13 * * *' // used 1pm daily rather midnight cause some rich list file generated after 12PM daily. its rare though
  },
  {
    method: vestingCollector.run.bind(vestingCollector),
    cron: '0 0 13 * * *' // used 1pm daily rather midnight cause some rich list file generated after 12PM daily. its rare though
  }
]

async function createJobs() {
  for (const job of jobs) {
    nodeCron.schedule(job.cron, job.method)
  }
}

const init = async () => {
  initializeSentry()
  await initORM()
  await initToken()
  await collectBlock()
  // Initialize validator_info table when it is empty
  await getRepository(ValidatorInfoEntity)
    .count()
    .then((c) => {
      if (c === 0) {
        return collectValidator()
      }
    })
  await createJobs()
  await startWatcher()
  await startPolling()
}

init().catch(logger.error)
