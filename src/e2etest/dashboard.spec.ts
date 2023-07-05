import { SuperTest, Test } from 'supertest'
import { setupAgent, terminateAPITest } from './lib/agent'

import { plus, div, times } from 'lib/math'
import { MOVING_AVG_WINDOW_IN_DAYS, DAYS_IN_YEAR } from 'lib/constant'

describe('Dashboard Test', () => {
  let agent: SuperTest<Test>
  let connection

  beforeAll(async () => {
    ({ agent, connection } = await setupAgent())
  })

  afterAll(async () => {
    await terminateAPITest({ connection })
  })

  test('Test get dashboard general info', async () => {
    const { body } = await agent.get(`/v1/dashboard`).expect(200)

    expect(body).toMatchObject({
      prices: expect.any(Object),
      taxRate: expect.any(String),
      taxCaps: expect.arrayContaining([
        {
          denom: expect.any(String),
          taxCap: expect.any(String)
        }
      ]),
      issuances: expect.any(Object),
      stakingPool: {
        stakingRatio: expect.any(String),
        bondedTokens: expect.any(String),
        notBondedTokens: expect.any(String)
      },
      communityPool: expect.any(Object)
    })
  })

  test('Test get tx volumes', async () => {
    const { body } = await agent.get(`/v1/dashboard/tx_volume`).expect(200)

    expect(body.cumulative.length).toBeGreaterThan(0)
    expect(body.cumulative[0].denom).toBeString()
    expect(body.cumulative[0].data).toBeArray()

    expect(body.periodic.length).toBeGreaterThan(0)
    expect(body.periodic[0].denom).toBeString()
    expect(body.periodic[0].data).toBeArray()
  })

  test('Test get block rewards', async () => {
    const { body } = await agent.get(`/v1/dashboard/block_rewards`).expect(200)

    expect(body.cumulative.length).toBeGreaterThan(0)
    expect(body.cumulative[0].datetime).toBeNumber()
    expect(body.cumulative[0].blockReward).toBeString()

    expect(body.periodic.length).toBeGreaterThan(0)
    expect(body.periodic[0].datetime).toBeNumber()
    expect(body.periodic[0].blockReward).toBeString()
  })

  test('Test get seigniorage proceeds', async () => {
    const { body } = await agent.get(`/v1/dashboard/seigniorage_proceeds`).expect(200)

    expect(body.length).toBeGreaterThan(0)
    expect(body[0].datetime).toBeNumber()
    expect(body[0].seigniorageProceeds).toBeString()
  })

  test('Test get staking return', async () => {
    const { body } = await agent.get(`/v1/dashboard/staking_return`).expect(200)

    expect(body.length).toBeGreaterThan(0)
    expect(body[0].datetime).toBeNumber()
    expect(body[0].dailyReturn).toBeString()
    expect(body[0].annualizedReturn).toBeString()
  })

  test('Test get staking ratio', async () => {
    const { body } = await agent.get(`/v1/dashboard/staking_ratio`).expect(200)

    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toMatchObject({
      datetime: expect.any(Number),
      stakingRatio: expect.any(Number)
    })
  })

  test('Test get check annual staking return with moving avg', async () => {
    const { body } = await agent.get(`/v1/dashboard/staking_return`).expect(200)

    expect(body.length).toBeGreaterThan(0)
    expect(body[0].datetime).toBeNumber()
    expect(body[0].dailyReturn).toBeString()
    expect(body[0].annualizedReturn).toBeString()

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

  test('Test get account growth', async () => {
    const { body } = await agent.get(`/v1/dashboard/account_growth`).expect(200)

    expect(body.cumulative.length).toBeGreaterThan(0)
    expect(body.cumulative[0].datetime).toBeNumber()
    expect(body.cumulative[0].totalAccountCount).toBeNumber()
    expect(body.cumulative[0].activeAccountCount).toBeNumber()

    expect(body.periodic.length).toBeGreaterThan(0)
    expect(body.periodic[0].datetime).toBeNumber()
    expect(body.periodic[0].totalAccountCount).toBeNumber()
    expect(body.periodic[0].activeAccountCount).toBeNumber()
  })

  test('Test active accounts return', async () => {
    const { body } = await agent.get('/v1/dashboard/active_accounts').expect(200)

    expect(body.total).toBeGreaterThanOrEqual(0)
    expect(body.periodic).toBeArray()
    expect(body.cumulative).toBeUndefined()
  })

  test('Test registered accounts return', async () => {
    const { body } = await agent.get('/v1/dashboard/registered_accounts').expect(200)

    expect(body.total).toBeGreaterThanOrEqual(0)
    expect(body.periodic).toBeArray()
    expect(body.cumulative).toBeArray()
  })
})
