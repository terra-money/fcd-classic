import { init as initORM } from 'orm'
import * as nodeCron from 'node-cron'
import { get } from 'lodash'
import { default as parseDuration } from 'parse-duration'

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

const tenMinute = parseDuration('10m')
const twentyMinute = parseDuration('20m')

const blockCollector = new Semaphore('BlockCollector', collectBlock, logger, tenMinute) // 10 min timeout time as block collector has a loop
const priceCollector = new Semaphore('PriceCollector', collectPrice, logger) // default 1 min timeout
const generalCollector = new Semaphore('GeneralCollector', collectorGeneral, logger) // default 1 min timeout
const validatorCollector = new Semaphore('ValidatorCollector', collectValidator, logger) // default 1 min timeout
const returnCalculator = new Semaphore('ReturnCalculator', calculateValidatorsReturn, logger, tenMinute) // 10 min timeout
const proposalCollector = new Semaphore('ProposalCollector', collectProposal, logger) // 1 min timeout
const dashboardCollector = new Semaphore('DashboardCollector', collectDashboard, logger, twentyMinute) // 20 mins as took 3 mins go get users count
const richListCollector = new Semaphore('RichListCollector', collectRichList, logger, tenMinute) // run once a day and huge data
const vestingCollector = new Semaphore('VestingCollector', collectUnvested, logger, tenMinute) // run once a day

const jobs = [
  // Per second
  {
    method: blockCollector.run.bind(blockCollector),
    cron: '* * * * * *'
  },
  // Per minute
  {
    method: generalCollector.run.bind(generalCollector),
    cron: '0 * * * * *'
  },
  {
    method: proposalCollector.run.bind(proposalCollector),
    cron: '5 * * * * *'
  },
  {
    method: validatorCollector.run.bind(validatorCollector),
    cron: '10 * * * * *'
  },
  {
    method: priceCollector.run.bind(priceCollector),
    cron: '50 * * * * *'
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
  await rpcEventWatcher()
}

init()
  .then(() => {
    createJobs().catch((err) => {
      logger.error(err)
    })
  })
  .catch(logger.error)
