import * as nodeCron from 'node-cron'
import { init as initORM } from 'orm'
import fcdHealth from './fcdHealth'
import collectorSync from './collectorSync'

const jobs = [
  {
    method: fcdHealth,
    cron: '*/10 * * * * *'
  },
  {
    method: collectorSync,
    cron: '0 * * * * *'
  }
]

function createJobs(): void {
  for (const job of jobs) {
    nodeCron.schedule(job.cron, job.method)
  }
}

const init = async (): Promise<void> => {
  await initORM()
}

init().then(createJobs).catch(console.error)
