import 'jest-extended'
import { SuperTest, Test } from 'supertest'
import { setupAgent, terminateAPITest } from './lib/agent'
import config from 'config'

describe('Market Test', () => {
  let agent: SuperTest<Test>
  let connection

  beforeAll(async () => {
    ({ agent, connection } = await setupAgent())
  })

  afterAll(async () => {
    await terminateAPITest({ connection })
  })

  test('get swaprate', async () => {
    await Promise.all(
      config.ACTIVE_DENOMS.map(async (denom) => {
        const { body } = await agent.get(`/v1/market/swaprate/${denom}`).expect(200)

        expect(body).not.toBeArrayOfSize(0)
        expect(body).toIncludeAnyMembers([
          {
            denom: expect.any(String),
            swaprate: expect.any(String),
            oneDayVariation: expect.any(String),
            oneDayVariationRate: expect.any(String)
          }
        ])
      })
    )
  })

  test('get price invalid denom', async () => {
    await agent.get(`/v1/market/price?denom=uusf&interval=15m`).expect(400)
  })

  test('get price', async () => {
    const { body } = await agent.get(`/v1/market/price?denom=uusd&interval=1d`).expect(200)

    expect(body).toMatchObject({
      lastPrice: expect.any(Number),
      oneDayVariation: expect.any(String),
      oneDayVariationRate: expect.any(String),
      prices: expect.arrayContaining([
        {
          datetime: expect.any(Number),
          denom: expect.toBeOneOf(config.ACTIVE_DENOMS),
          price: expect.any(Number)
        }
      ])
    })
  })
})
