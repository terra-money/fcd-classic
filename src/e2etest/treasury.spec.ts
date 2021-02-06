import { SuperTest, Test } from 'supertest'
import config from 'config'
import { setupAgent, terminateAPITest } from './lib/agent'

describe('Network Info Test', () => {
  let agent: SuperTest<Test>
  let connection

  beforeAll(async () => {
    ({ agent, connection } = await setupAgent())
  })

  afterAll(async () => {
    await terminateAPITest({ connection })
  })

  test('Test get tax proceeds', async () => {
    const { body } = await agent.get(`/v1/taxproceeds`).expect(200)

    expect(body).toBeDefined()
    expect(body.total).toBeDefined()
    expect(body.taxProceeds).toBeDefined()
  })

  test('Test get total supply by denom', async () => {
    await Promise.all(config.ACTIVE_DENOMS.map((denom) => agent.get(`/v1/totalsupply/${denom}`).expect(200)))

    await Promise.all(config.ACTIVE_CURRENCY.map((currency) => agent.get(`/v1/totalsupply/${currency}`).expect(200)))
  })

  test('Test get richlist', async () => {
    await Promise.all(config.ACTIVE_DENOMS.map((denom) => agent.get(`/v1/richlist/${denom}`).expect(200)))
  })

  test('Test get circulatingsupply', async () => {
    await Promise.all(config.ACTIVE_DENOMS.map((denom) => agent.get(`/v1/circulatingsupply/${denom}`).expect(200)))

    await Promise.all(
      config.ACTIVE_CURRENCY.map((currency) => agent.get(`/v1/circulatingsupply/${currency}`).expect(200))
    )
  })

  test('Test get circulatingsupply with unknown demons', async () => {
    await agent.get(`/v1/circulatingsupply/unknown`).expect(400)
  })
})
