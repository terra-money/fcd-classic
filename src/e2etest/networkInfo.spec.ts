import { SuperTest, Test } from 'supertest'
import { setupAgent, terminateAPITest } from './lib/agent'

const denoms = ['uusd', 'ukrw', 'usdr', 'umnt', 'uluna']

jest.mock('request-promise-native')

describe('Network Info Test', () => {
  let agent: SuperTest<Test>
  let connection

  beforeAll(async () => {
    ;({ agent, connection } = await setupAgent())
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

  test('Test get total supply', async () => {
    for (let i = 0; i < denoms.length; i = i + 1) {
      await agent.get(`/v1/totalsupply/${denoms[i]}`).expect(200)
    }
  })

  test('Test get richlist', async () => {
    for (let i = 0; i < denoms.length; i = i + 1) {
      await agent.get(`/v1/richlist/${denoms[i]}`).expect(200)
    }
  })

  test('Test get circulatingsupply', async () => {
    for (let i = 0; i < denoms.length; i = i + 1) {
      await agent.get(`/v1/circulatingsupply/${denoms[i]}`).expect(200)
    }
  })

  test('Test get circulatingsupply with failed demons', async () => {
    for (let i = 0; i < denoms.length; i = i + 1) {
      await agent.get(`/v1/circulatingsupply/${denoms[i]}ab`).expect(400)
    }
  })
})
