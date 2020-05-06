import { init as initORM } from 'orm'
import * as nodeCron from 'node-cron'
import { get } from 'lodash'

import { vsLogger as logger } from 'lib/logger'
import { initializeSentry } from 'lib/errorReporting'
import Semaphore from './Semaphore'
import { saveValidatorInfo } from './staking/ValidatorScraper'
import { calculateValidatorsReturn } from './preCalcValidatorReturn'
import { scrapeAndSaveProposalsInfo } from './gov/govScrapper'

process.on('unhandledRejection', (err) => {
  logger.error({
    type: 'SYSTEM_ERROR',
    message: get(err, 'message'),
    stack: get(err, 'stack')
  })
})

const validatorScrapper = new Semaphore('ValidatorScrapper', saveValidatorInfo, logger)
const returnCalculator = new Semaphore('ReturnCalculator', calculateValidatorsReturn, logger)
const proposalScrapper = new Semaphore('ProposalScrapper', scrapeAndSaveProposalsInfo, logger)

const jobs = [
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
