import 'jest-extended'
import { SuperTest, Test } from 'supertest'
import { setupAgent, terminateAPITest } from './lib/agent'
import config from 'config'

const VALID_TX = 'E339D4F9B1529AB4946193F5FFB21F2E34404A47979F89E3FEF4CB1A98C7658D'
const VALID_ACCOUNT = 'terra1940nsxkz62snd3azk3a9j79m4qd3qvwnrf2xvj'

const INVALID_TX = '27453FD8220A3903359E99D50D06C6C8012D5F9CEC6ED7257BB0F5E9FB115F37'

const TXLIST_TARGET_BLOCK = '772'
const TXLIST_TARGET_BLOCK_EXPECTED_TX_HASH = 'E339D4F9B1529AB4946193F5FFB21F2E34404A47979F89E3FEF4CB1A98C7658D'

const TXLIST_MEMO = 'forFcdMemoTest'
const TXLIST_MEMO_EXPECTED_TX_HASH = '50ACC09985B097D337C5C34894F2D95FBD7F3201F7F8EA202E793B61C9B8B185'

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
  success: expect.any(Boolean),
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
  timestamp: expect.any(String),
  events: expect.arrayContaining([eventObject])
}

const parsedTxObject = {
  chainId: expect.any(String),
  memo: expect.any(String),
  success: expect.any(Boolean),
  timestamp: expect.any(String),
  txhash: expect.any(String),
  txFee: expect.arrayContaining([coinObject]),
  msgs: expect.arrayContaining([
    {
      out: expect.arrayContaining([coinObject]),
      in: expect.arrayContaining([coinObject]),
      tag: expect.any(String),
      text: expect.any(String),
      tax: expect.any(String)
    }
  ])
}

function addOptionalProperties(parsedTx: ParsedTxInfo): ParsedTxInfo {
  const msgsWithOptionalKeys = parsedTx.msgs.map((msg) => {
    return Object.assign(
      {},
      {
        in: [
          {
            denom: 'uluna',
            amount: '0'
          }
        ],
        out: [
          {
            denom: 'uluna',
            amount: '0'
          }
        ],
        tag: '',
        text: '',
        tax: ''
      },
      msg
    )
  })
  return { ...parsedTx, ...{ msgs: msgsWithOptionalKeys } }
}

function testPagination(body): void {
  expect(body).toMatchObject({
    totalCnt: expect.any(Number),
    page: expect.any(Number),
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
    ;({ agent, connection } = await setupAgent())
  })

  afterAll(async () => {
    await terminateAPITest({ connection })
  })

  test('get tx', async () => {
    const { body } = await agent.get(`/v1/tx/${VALID_TX}`).expect(200)

    expect(body).toMatchObject(transactionObject)
  })

  test('get invalid tx', async () => {
    const { body } = await agent.get(`/v1/tx/${INVALID_TX}`).expect(200)

    expect(body).toBeObject()
    expect(body).toBeEmpty()
  })

  test(`get account's tx list`, async () => {
    const { body } = await agent.get(`/v1/txs?account=${VALID_ACCOUNT}`).expect(200)

    testTransactions(body)
  })

  test('get tx list pagination', async () => {
    const { body } = await agent.get(`/v1/txs?account=${VALID_ACCOUNT}&page=2&limit=5`).expect(200)

    testTransactions(body)
  })

  test('get tx list pagination with chainId', async () => {
    const { body } = await agent
      .get(`/v1/txs?account=${VALID_ACCOUNT}&page=2&limit=5&chainId=${config.CHAIN_ID}`)
      .expect(200)

    testTransactions(body)
  })

  test('get tx list pagination with invalid chainId params', async () => {
    await agent.get(`/v1/txs?account=${VALID_ACCOUNT}&page=2&limit=5&chainId=${config.CHAIN_ID}xyz`).expect(400)
  })

  test(`account's tx list action filter`, async () => {
    const { body } = await agent.get(`/v1/txs?account=${VALID_ACCOUNT}&action=staking`).expect(200)

    testTransactions(body)
  })

  test(`get block's tx list`, async () => {
    const { body } = await agent.get(`/v1/txs?block=${TXLIST_TARGET_BLOCK}`).expect(200)

    testTransactions(body)
    expect(body.txs[0].txhash).toBe(TXLIST_TARGET_BLOCK_EXPECTED_TX_HASH)
  })

  test('get tx list memo filter', async () => {
    const { body } = await agent.get(`/v1/txs?memo=${TXLIST_MEMO}`).expect(200)

    testTransactions(body)
    expect(body.txs[0].txhash).toBe(TXLIST_MEMO_EXPECTED_TX_HASH)
  })

  test('get tx list', async () => {
    const { body } = await agent.get(`/v1/txs`).expect(200)

    expect(body.txs).toBeDefined()
    expect(body.txs.length).toBe(10)
  })

  test('get parsed tx list', async () => {
    const { body } = await agent.get(`/v1/msgs?account=${VALID_ACCOUNT}`).expect(200)
    testPagination(body)
    expect(body.txs).not.toBeArrayOfSize(0)
    expect(addOptionalProperties(body.txs[0])).toMatchObject(parsedTxObject)
  })

  test('get parsed tx list action filter', async () => {
    const { body } = await agent.get(`/v1/msgs?account=${VALID_ACCOUNT}&action=governance`).expect(200)

    testPagination(body)

    const tx = body.txs.find((tx) => tx.msgs.find((m) => m.tag === 'Governance'))
    const msg = tx.msgs.find((m) => m.tag === 'Governance')

    expect(msg).toMatchObject({
      tag: expect.any(String),
      text: expect.stringMatching('Voted')
    })
    expect(addOptionalProperties(body.txs[0])).toMatchObject(parsedTxObject)
  })

  test('get parsed tx list datetime filter', async () => {
    const { body } = await agent
      .get(`/v1/msgs?account=${VALID_ACCOUNT}&to=1587808652000&from=1587804294000`)
      .expect(200)

    testPagination(body)
    expect(body.txs).toBeArray()
    expect(addOptionalProperties(body.txs[0])).toMatchObject(parsedTxObject)
  })

  test('get parsed tx list having invalid accout address', async () => {
    const { body } = await agent
      .get(`/v1/msgs?account=${VALID_ACCOUNT}_&to=1587808652000&from=1587804294000`)
      .expect(400)
  })

  test('get txs with invalid max return count', async () => {
    const { body } = await agent.get(`/v1/txs?page=1&limit=200`).expect(400)
  })

  test('get parsed txs with invalid max return count', async () => {
    const { body } = await agent.get(`/v1/msgs?page=1&limit=200`).expect(400)
  })

  test('get txs with sql injection', async () => {
    const { body } = await agent.get(`/v1/txs?memo=SELECT USER`).expect(200)
    expect(body.txs.length).toBe(0)
  })

  test('get txs with memo', async () => {
    const { body } = await agent.get(`/v1/txs?memo=faucet`).expect(200)
    expect(body.txs.length).toBeGreaterThan(0)
  })

  test('get min gas price', async () => {
    const { body } = await agent.get(`/v1/txs/gas_prices`).expect(200)
    expect(body.uluna).toBeDefined()
    expect(body.uluna).toBeString()
    expect(body.usdr).toBeDefined()
    expect(body.usdr).toBeString()
    expect(body.uusd).toBeDefined()
    expect(body.uusd).toBeString()
    expect(body.ukrw).toBeDefined()
    expect(body.ukrw).toBeString()
    expect(body.umnt).toBeDefined()
    expect(body.umnt).toBeString()
  })
})
