import 'jest-extended'
import { SuperTest, Test } from 'supertest'
import { setupAgent, terminateAPITest } from './lib/agent'

const VALID_TX = 'CB3BB96B3B201B738BB87220883289D2D892C2021E6E403F4F406DC687C1FA4D'
const VALID_ACCOUNT = 'terra12t890qauaz42ltzzx3rxj7gu74jvwmzw9659zn'

const INVALID_TX = '27453FD8220A3903359E99D50D06C6C8012D5F9CEC6ED7257BB0F5E9FB115F37'

const TXLIST_TARGET_BLOCK = '13228323'
const TXLIST_TARGET_BLOCK_EXPECTED_TX_HASH = 'BD60B278E0248D9E0CCEF5435CC74633CF4A628781B97220DBE1121D97924662'

const coinObject = {
  denom: expect.any(String),
  amount: expect.any(String)
}

const eventObject = {
  type: expect.any(String),
  attributes: expect.arrayContaining([
    {
      key: expect.any(String),
      value: expect.any(String)
    }
  ])
}

const logObject = {
  msg_index: expect.any(Number),
  events: expect.arrayContaining([eventObject]),
  log: expect.anything()
}

const signatureObject = {
  pub_key: {
    type: expect.any(String),
    value: expect.any(String)
  },
  signature: expect.any(String)
}

const messageObject = {
  type: expect.any(String),
  value: expect.toBeObject()
}

const transactionObject = {
  height: expect.any(String),
  txhash: expect.any(String),
  raw_log: expect.any(String),
  logs: expect.arrayContaining([logObject]),
  gas_wanted: expect.any(String),
  gas_used: expect.any(String),
  tx: {
    type: expect.any(String),
    value: {
      fee: {
        amount: expect.arrayContaining([coinObject]),
        gas: expect.any(String)
      },
      msg: expect.arrayContaining([messageObject]),
      signatures: expect.arrayContaining([signatureObject]),
      memo: expect.any(String)
    }
  },
  timestamp: expect.any(String)
}

function testPagination(body): void {
  expect(body).toMatchObject({
    limit: expect.any(Number)
  })
}

function testTransactions(body): void {
  testPagination(body)
  expect(body.txs[0]).toMatchObject(transactionObject)
}

describe('Transaction', () => {
  let agent: SuperTest<Test>
  let connection

  beforeAll(async () => {
    ({ agent, connection } = await setupAgent())
  })

  afterAll(async () => {
    await terminateAPITest({ connection })
  })

  test('get tx', async () => {
    const { body } = await agent.get(`/v1/tx/${VALID_TX}`).expect(200)

    expect(body).toMatchObject(transactionObject)
  })

  test('get invalid tx', async () => {
    await agent.get(`/v1/tx/${INVALID_TX}`).expect(404)
  })

  test(`get account's tx list`, async () => {
    const { body } = await agent.get(`/v1/txs?account=${VALID_ACCOUNT}`).expect(200)
    testTransactions(body)
  })

  test('get tx list pagination', async () => {
    await agent.get(`/v1/txs?account=${VALID_ACCOUNT}&limit=10&offset=1`).expect(200)
  })

  test('get tx list with invalid chainId', async () => {
    await agent.get(`/v1/txs?account=${VALID_ACCOUNT}&chainId=@fx`).expect(400)
  })

  test(`get block's tx list`, async () => {
    // Tx with fee requird
    const { body } = await agent.get(`/v1/txs?block=${TXLIST_TARGET_BLOCK}&limit=100`).expect(200)

    testTransactions(body)
    expect(body.txs[0].txhash).toBe(TXLIST_TARGET_BLOCK_EXPECTED_TX_HASH)
  })

  test('get tx list', async () => {
    const { body } = await agent.get(`/v1/txs`).expect(200)

    expect(body.txs).toBeDefined()
    expect(body.txs.length).toBe(10)
  })

  test('get txs over limit', async () => {
    await agent.get(`/v1/txs?page=1&limit=200`).expect(400)
  })

  test('get txs with invalid chain id', async () => {
    await agent.get(`/v1/txs?chainId=SELECT USER`).expect(400)
  })

  test('get min gas price', async () => {
    const { body } = await agent.get(`/v1/txs/gas_prices`).expect(200)
    expect(body).toMatchObject({
      uluna: expect.any(String)
    })
  })
})
