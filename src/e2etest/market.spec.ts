import 'jest-extended'
import { SuperTest, Test } from 'supertest'
import { setupAgent, terminateAPITest } from './lib/agent'

const denoms = ['uusd', 'ukrw', 'usdr', 'umnt', 'uluna']

describe('Market Test', () => {
  let agent: SuperTest<Test>
  let connection

  beforeAll(async () => {
    ;({ agent, connection } = await setupAgent())
  })

  afterAll(async () => {
    await terminateAPITest({ connection })
  })

  test('get swaprate', async () => {
    for (let i = 0; i < denoms.length; i = i + 1) {
      const { body } = await agent.get(`/v1/market/swaprate/${denoms[i]}`).expect(200)

      expect(body).not.toBeArrayOfSize(0)
      expect(body).toIncludeAnyMembers([
        {
          denom: expect.any(String),
          swaprate: expect.any(String),
          oneDayVariation: expect.any(String),
          oneDayVariationRate: expect.any(String)
        }
      ])
    }
  })

  test('get price invalid denom', async () => {
    await agent.get(`/v1/market/price?denom=ukre&interval=15m`).expect(400)
  })

  test('get price', async () => {
    const { body } = await agent.get(`/v1/market/price?denom=ukrw&interval=15m&count=10`).expect(200)

    expect(body).toMatchObject({
      lastPrice: expect.any(Number),
      oneDayVariation: expect.any(String),
      oneDayVariationRate: expect.any(String),
      prices: expect.arrayContaining([
        {
          datetime: expect.any(Number),
          denom: expect.toBeOneOf(denoms),
          price: expect.any(Number)
        }
      ])
    })
  })
})
