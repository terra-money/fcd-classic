import { timeoutPromise } from 'lib/timeoutPromise'
import { Logger } from 'winston'

type Process = () => Promise<void>

const TIMEOUT_DEFAULT = 60 * 1000 // 1 minute

export default class Semaphore {
  isRunning: boolean

  constructor(
    private name: string,
    private process: Process,
    private logger: Logger,
    private timeoutMS: number | null = TIMEOUT_DEFAULT
  ) {
    this.isRunning = false
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
