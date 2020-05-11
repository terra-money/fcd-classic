import { init as initORM } from 'orm'
import * as nodeCron from 'node-cron'
import { get } from 'lodash'

import { collectorLogger as logger } from 'lib/logger'
import { initializeSentry } from 'lib/errorReporting'
import { collectBlock } from './block'
import { collectPrice } from './price'
import { collectorGeneral } from './general'
import { saveValidatorInfo } from './staking/ValidatorScraper'
import { calculateValidatorsReturn } from './preCalcValidatorReturn'
import { scrapeAndSaveProposalsInfo } from './gov/govScrapper'
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
const validatorScrapper = new Semaphore('ValidatorScrapper', saveValidatorInfo, logger)
const returnCalculator = new Semaphore('ReturnCalculator', calculateValidatorsReturn, logger)
const proposalScrapper = new Semaphore('ProposalScrapper', scrapeAndSaveProposalsInfo, logger)

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
    cron: '1 * * * * *'
  },
  {
    method: validatorScrapper.run.bind(validatorScrapper),
    cron: '1 * * * * *'
  },
  {
    method: returnCalculator.run.bind(returnCalculator),
    cron: '1 * * * * *'
  },
  {
    method: proposalScrapper.run.bind(proposalScrapper),
    cron: '1 * * * * *'
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
