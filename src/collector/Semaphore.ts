import { Logger } from 'winston'

type Process = () => Promise<void>

export default class Semaphore {
  isRunning: boolean
  name: string
  logger: Logger
  process: Process
  constructor(name: string, process: Process, logger: Logger) {
    this.isRunning = false
    this.name = name
    this.process = process
    this.logger = logger
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
      await this.process()
      this.logger.info(`Process ${this.name} ended.`)
    } catch (error) {
      this.logger.error(`Failed to run process ${this.name}`)
      this.logger.error(`Process ${this.name} failed with error ${error}`)
    }
    this.isRunning = false
  }
}
