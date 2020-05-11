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
import Semaphore from './Semaphore'

process.on('unhandledRejection', (err) => {
  logger.error({
    type: 'SYSTEM_ERROR',
    message: get(err, 'message'),
    stack: get(err, 'stack')
  })
})

const blockCollector = new Semaphore('BlockCollector', collectBlock, logger)
const priceCollector = new Semaphore('PriceCollector', collectPrice, logger)
const generalCollector = new Semaphore('GeneralCollector', collectorGeneral, logger)
const validatorCollector = new Semaphore('ValidatorCollector', collectValidator, logger)
const returnCalculator = new Semaphore('ReturnCalculator', calculateValidatorsReturn, logger)
const proposalCollector = new Semaphore('ProposalCollector', collectProposal, logger)

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
    cron: '10 * * * * *'
  },
  {
    method: returnCalculator.run.bind(returnCalculator),
    cron: '20 * * * * *'
  },
  {
    method: proposalCollector.run.bind(proposalCollector),
    cron: '30 * * * * *'
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
