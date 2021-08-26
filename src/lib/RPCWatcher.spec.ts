import RPCWatcher from './RPCWatcher'
import * as winston from 'winston'
import { delay } from 'bluebird'

describe('RPCWatcher', () => {
  let watcher: RPCWatcher
  let okay = false

  beforeAll(() => {
    const logger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      defaultMeta: { service: 'user-service' },
      transports: [new winston.transports.Console()]
    })

    watcher = new RPCWatcher({ url: 'ws://localhost:26657/websocket', logger })
  })

  beforeEach(() => {
    okay = false
  })

  afterAll(() => {
    watcher.close()
  })

  test('registerSubscriber', () => {
    watcher.registerSubscriber(`tm.event='NewBlock'`, () => {
      okay = true
    })
  })

  test('start', async () => {
    watcher.start()
    await delay(6000)
    expect(okay).toBe(true)
  })

  test('restart', async () => {
    watcher.restart()
    await delay(6000)
    expect(okay).toBe(true)
  })
})
