import { SuperTest, Test } from 'supertest'
import { setupAgent, terminateAPITest } from './lib/agent'

import { plus, div, times } from 'lib/math'
import { MOVING_AVG_WINDOW_IN_DAYS, DAYS_IN_YEAR } from 'lib/constant'
jest.mock('request-promise-native')

const DATA_POINT_COUNT = 4

describe('Dashboard Test', () => {
  let agent: SuperTest<Test>
  let connection

  beforeAll(async () => {
    ;({ agent, connection } = await setupAgent())
  })

  afterAll(async () => {
    await terminateAPITest({ connection })
  })

  test('Test get dashboard general info', async () => {
    const { body } = await agent.get(`/v1/dashboard`).expect(200)

    expect(body.prices).toMatchObject({
      ukrw: expect.any(String),
      usdr: expect.any(String),
      uusd: expect.any(String)
    })
    expect(typeof body.taxRate).toBe('string')
    expect(body.taxCaps).toBeInstanceOf(Array)
    expect(body.taxCaps.length).toBeGreaterThan(0)

    expect(body.issuances).toMatchObject({
      uluna: expect.any(String),
      ukrw: expect.any(String),
      usdr: expect.any(String),
      uusd: expect.any(String),
      umnt: expect.any(String)
    })

    expect(body.stakingPool).toBeDefined()
    expect(body.stakingPool.stakingRatio).toBeDefined()
    expect(body.stakingPool.bondedTokens).toBeDefined()
    expect(body.stakingPool.notBondedTokens).toBeDefined()

    expect(body.communityPool).toBeDefined()
    expect(body.communityPool.uluna).toBeDefined()
    expect(body.communityPool.ukrw).toBeDefined()
    expect(body.communityPool.uusd).toBeDefined()
    expect(body.communityPool.usdr).toBeDefined()
  })

  test('Test get account growth', async () => {
    const { body } = await agent.get(`/v1/dashboard/account_growth`).expect(200)

    expect(body.cumulative).toBeDefined()
    expect(body.cumulative.length).toBeGreaterThan(0)
    expect(body.cumulative[0]).toBeDefined()
    expect(body.cumulative[0].datetime).toBeDefined()
    expect(body.cumulative[0].totalAccountCount).toBeDefined()
    expect(body.cumulative[0].activeAccountCount).toBeDefined()

    expect(body.periodic).toBeDefined()
    expect(body.periodic.length).toBeGreaterThan(0)
    expect(body.periodic[0]).toBeDefined()
    expect(body.periodic[0].datetime).toBeDefined()
    expect(body.periodic[0].totalAccountCount).toBeDefined()
    expect(body.periodic[0].activeAccountCount).toBeDefined()
  })

  test('Test get account growth count filter', async () => {
    const { body } = await agent.get(`/v1/dashboard/account_growth?count=${DATA_POINT_COUNT}`).expect(200)

    expect(body.cumulative).toBeDefined()
    expect(body.cumulative.length).toBe(DATA_POINT_COUNT - 1)
    expect(body.cumulative[0]).toBeDefined()
    expect(body.cumulative[0].datetime).toBeDefined()
    expect(body.cumulative[0].totalAccountCount).toBeDefined()
    expect(body.cumulative[0].activeAccountCount).toBeDefined()

    expect(body.periodic).toBeDefined()
    expect(body.periodic.length).toBe(DATA_POINT_COUNT - 1)
    expect(body.periodic[0]).toBeDefined()
    expect(body.periodic[0].datetime).toBeDefined()
    expect(body.periodic[0].totalAccountCount).toBeDefined()
    expect(body.periodic[0].activeAccountCount).toBeDefined()
  })

  test('Test get tx volumes', async () => {
    const { body } = await agent.get(`/v1/dashboard/tx_volume`).expect(200)

    expect(body.cumulative).toBeDefined()
    expect(body.cumulative.length).toBe(5)
    expect(body.cumulative[0]).toBeDefined()
    expect(body.cumulative[0].denom).toBeDefined()
    expect(body.cumulative[0].data).toBeDefined()

    expect(body.periodic).toBeDefined()
    expect(body.periodic.length).toBe(5)
    expect(body.periodic[0]).toBeDefined()
    expect(body.periodic[0].denom).toBeDefined()
    expect(body.periodic[0].data).toBeDefined()
  })

  test('Test get tx volumes with count filter', async () => {
    const { body } = await agent.get(`/v1/dashboard/tx_volume?count=${DATA_POINT_COUNT}`).expect(200)

    expect(body.cumulative).toBeDefined()
    expect(body.cumulative.length).toBe(5)
    expect(body.cumulative[0]).toBeDefined()
    expect(body.cumulative[0].denom).toBeDefined()
    expect(body.cumulative[0].data).toBeDefined()
    expect(body.cumulative[0].data.length).toBe(DATA_POINT_COUNT)

    expect(body.periodic).toBeDefined()
    expect(body.periodic.length).toBe(5)
    expect(body.periodic[0]).toBeDefined()
    expect(body.periodic[0].denom).toBeDefined()
    expect(body.periodic[0].data).toBeDefined()
    expect(body.periodic[0].data.length).toBe(DATA_POINT_COUNT)
  })

  test('Test get block rewards', async () => {
    const { body } = await agent.get(`/v1/dashboard/block_rewards`).expect(200)

    expect(body.cumulative).toBeDefined()
    expect(body.cumulative.length).toBeGreaterThan(0)
    expect(body.cumulative[0]).toBeDefined()
    expect(body.cumulative[0].datetime).toBeDefined()
    expect(body.cumulative[0].blockReward).toBeDefined()

    expect(body.periodic).toBeDefined()
    expect(body.periodic.length).toBeGreaterThan(0)
    expect(body.periodic[0]).toBeDefined()
    expect(body.periodic[0].datetime).toBeDefined()
    expect(body.periodic[0].blockReward).toBeDefined()
  })

  test('Test get block rewards with count filter', async () => {
    const { body } = await agent.get(`/v1/dashboard/block_rewards?count=${DATA_POINT_COUNT}`).expect(200)

    expect(body.cumulative).toBeDefined()
    expect(body.cumulative.length).toBe(DATA_POINT_COUNT)
    expect(body.cumulative[0]).toBeDefined()
    expect(body.cumulative[0].datetime).toBeDefined()
    expect(body.cumulative[0].blockReward).toBeDefined()

    expect(body).toBeDefined()
    expect(body.periodic).toBeDefined()
    expect(body.periodic.length).toBe(DATA_POINT_COUNT)
    expect(body.periodic[0]).toBeDefined()
    expect(body.periodic[0].datetime).toBeDefined()
    expect(body.periodic[0].blockReward).toBeDefined()
  })

  test('Test get seigniorage proceeds', async () => {
    const { body } = await agent.get(`/v1/dashboard/seigniorage_proceeds`).expect(200)

    expect(body).toBeInstanceOf(Array)
    expect(body.length).toBeGreaterThan(0)

    expect(body[0]).toBeDefined()
    expect(body[0].datetime).toBeDefined()
    expect(body[0].seigniorageProceeds).toBeDefined()
  })

  test('Test get seigniorage proceeds with invalid count', async () => {
    await agent.get(`/v1/dashboard/seigniorage_proceeds?count=-1`).expect(400)
  })

  test('Test get staking return', async () => {
    const { body } = await agent.get(`/v1/dashboard/staking_return`).expect(200)

    expect(body).toBeInstanceOf(Array)
    expect(body.length).toBeGreaterThan(0)

    expect(body[0]).toBeDefined()
    expect(body[0].datetime).toBeDefined()
    expect(body[0].dailyReturn).toBeDefined()
    expect(body[0].annualizedReturn).toBeDefined()
  })

  test('Test get staking return with count', async () => {
    const { body } = await agent.get(`/v1/dashboard/staking_return?count=${DATA_POINT_COUNT}`).expect(200)

    expect(body).toBeInstanceOf(Array)
    expect(body.length).toBe(DATA_POINT_COUNT)

    expect(body[0]).toBeDefined()
    expect(body[0].datetime).toBeDefined()
    expect(body[0].dailyReturn).toBeDefined()
    expect(body[0].annualizedReturn).toBeDefined()
  })

  test('Test get check annual staking return with moving avg', async () => {
    const { body } = await agent.get(`/v1/dashboard/staking_return`).expect(200)

    expect(body).toBeInstanceOf(Array)
    expect(body[0]).toBeDefined()
    expect(body[0].datetime).toBeDefined()
    expect(body[0].dailyReturn).toBeDefined()
    expect(body[0].annualizedReturn).toBeDefined()

    for (let i = 0; i < body.length; i = i + 1) {
      let cummulativeSum = '0'
      let dataCount = 0
      for (let j = 0; j < MOVING_AVG_WINDOW_IN_DAYS && i - j >= 0; j = j + 1) {
        cummulativeSum = plus(cummulativeSum, body[i - j].dailyReturn)
        dataCount = dataCount + 1
      }

      expect(times(div(cummulativeSum, dataCount), DAYS_IN_YEAR)).toBe(body[i].annualizedReturn)
    }
  })
})
