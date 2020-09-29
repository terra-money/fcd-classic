import { PROMISE_MAX_TIMEOUT_MS } from 'lib/constant'
import { timeoutPromise } from 'lib/timeoutPromise'
import { Logger } from 'winston'

type Process = () => Promise<void>

export default class Semaphore {
  isRunning: boolean
  name: string
  logger: Logger
  process: Process
  timeoutMS: number
  constructor(name: string, process: Process, logger: Logger, timeoutMS: number = PROMISE_MAX_TIMEOUT_MS) {
    this.isRunning = false
    this.name = name
    this.process = process
    this.logger = logger
    this.timeoutMS = timeoutMS
  }

  async run(): Promise<void> {
    this.logger.info(`Trying to run process ${this.name}`)
    if (this.isRunning) {
      this.logger.info(`Process ${this.name} is already running.`)
      return
    }
    this.isRunning = true
    try {
      this.logger.info(`Process ${this.name} starting...`)
      await timeoutPromise(this.process(), this.timeoutMS, `Timeout failed ${this.name}`)
      this.logger.info(`Process ${this.name} ended.`)
    } catch (error) {
      this.logger.error(`Failed to run process ${this.name}`)
      this.logger.error(`Process ${this.name} failed with error ${error}`)
    }
    this.isRunning = false
  }
}
