import { init as initORM } from 'orm'
import * as nodeCron from 'node-cron'
import { get } from 'lodash'

import { collectorLogger as logger } from 'lib/logger'
import { initializeSentry } from 'lib/errorReporting'

import { collectBlock } from './block'
import { collectPrice } from './price'
import { collectorGeneral } from './general'
import { collectValidator, calculateValidatorsReturn } from './staking'
import { collectProposal } from './gov'
import { collectDashboard } from './dashboard'
import { rpcEventWatcher } from './watcher'
import { collectRichList } from './richlist'
import { collectUnvested } from './unvested'

import Semaphore from './Semaphore'

process.on('unhandledRejection', (err) => {
  logger.error({
    type: 'SYSTEM_ERROR',
    message: get(err, 'message'),
    stack: get(err, 'stack')
  })
})

const TEN_MIN_IN_MS = 10 * 60 * 1000 // 10 min in milliseconds

const blockCollector = new Semaphore('BlockCollector', collectBlock, logger, TEN_MIN_IN_MS) // 10 min timeout time as block collector has a loop
const priceCollector = new Semaphore('PriceCollector', collectPrice, logger) // default 1 min timeout
const generalCollector = new Semaphore('GeneralCollector', collectorGeneral, logger) // default 1 min timeout
const validatorCollector = new Semaphore('ValidatorCollector', collectValidator, logger) // default 1 min timeout
const returnCalculator = new Semaphore('ReturnCalculator', calculateValidatorsReturn, logger, TEN_MIN_IN_MS) // 10 min timeout
const proposalCollector = new Semaphore('ProposalCollector', collectProposal, logger) // 1 min timeout
const dashboardCollector = new Semaphore('DashboardCollector', collectDashboard, logger, 2 * TEN_MIN_IN_MS) // 20 mins as took 3 mins go get users count
const richListCollector = new Semaphore('RichListCollector', collectRichList, logger, TEN_MIN_IN_MS)
const vestingCollector = new Semaphore('VestingCollector', collectUnvested, logger, TEN_MIN_IN_MS)

const jobs = [
  {
    method: blockCollector.run.bind(blockCollector),
    cron: '*/1 * * * * *'
  },
  {
    method: priceCollector.run.bind(priceCollector),
    cron: '50 * * * * *'
  },
  {
    method: generalCollector.run.bind(generalCollector),
    cron: '0 * * * * *'
  },
  {
    method: validatorCollector.run.bind(validatorCollector),
    cron: '0 */5 * * * *'
  },
  {
    method: returnCalculator.run.bind(returnCalculator),
    cron: '0 10 0 * * *'
  },
  {
    method: proposalCollector.run.bind(proposalCollector),
    cron: '0 */5 * * * *'
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
  await rpcEventWatcher()
}

init()
  .then(() => {
    createJobs().catch((err) => {
      logger.error(err)
    })
  })
  .catch(logger.error)
