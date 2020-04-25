import 'jest-extended'
import { SuperTest, Test } from 'supertest'
import { setupAgent, terminateAPITest } from './lib/agent'
import { getDepositInfo } from 'service/governance/helper'

jest.mock('request-promise-native')

const TEST_PROPOSAL_ID = 1
const NO_VOTE_PROPOSAL_ID = 999999

const coinObject = {
  denom: expect.any(String),
  amount: expect.any(String)
}

function testBasicProposal(proposal) {
  expect(proposal).toMatchObject({
    id: expect.any(String),
    proposer: {
      accountAddress: expect.any(String)
      // operatorAddress: expect.any(String),
      // moniker: expect.any(String),
    },
    type: expect.any(String),
    status: expect.any(String),
    submitTime: expect.any(String),
    title: expect.any(String),
    description: expect.any(String),
    deposit: {
      depositEndTime: expect.any(String),
      totalDeposit: expect.arrayContaining([coinObject]),
      minDeposit: expect.arrayContaining([coinObject])
    },
    vote: {
      distribution: {
        Yes: expect.any(String),
        No: expect.any(String),
        NoWithVeto: expect.any(String),
        Abstain: expect.any(String)
      },
      count: {
        Yes: expect.any(Number),
        No: expect.any(Number),
        NoWithVeto: expect.any(Number),
        Abstain: expect.any(Number)
      },
      total: expect.any(String),
      votingEndTime: expect.any(String),
      stakedLuna: expect.any(String)
    }
  })
}

function testVote(body) {
  expect(body).toMatchObject({
    totalCnt: expect.any(Number),
    page: expect.any(Number),
    limit: expect.any(Number),
    votes: expect.arrayContaining([
      {
        txhash: expect.any(String),
        answer: expect.any(String),
        voter: {
          accountAddress: expect.any(String)
        }
      }
    ])
  })
}

describe('Governance', () => {
  let agent: SuperTest<Test>
  let connection

  beforeAll(async (done) => {
    ;({ agent, connection } = await setupAgent())
    done()
  })

  afterAll(async (done) => {
    await terminateAPITest({ connection })
    done()
  })

  test('Test get proposals', async () => {
    const { body } = await agent.get(`/v1/gov/proposals`).expect(200)

    expect(body).toMatchObject({
      minDeposit: expect.toBeArray(),
      maxDepositPeriod: expect.any(String),
      votingPeriod: expect.any(String),
      proposals: expect.toBeArray()
    })

    const { proposals } = body

    expect(proposals).not.toBeArrayOfSize(0)
    testBasicProposal(proposals[0])
  })

  test('Test get proposals status filter', async () => {
    await agent.get(`/v1/gov/proposals?status=Rejected`).expect(200)
  })

  test('Test get proposals status with invalid filter', async () => {
    await agent.get(`/v1/gov/proposals?status=NotFound`).expect(400)
  })

  test('Test get proposal detail', async () => {
    const { body: proposal } = await agent.get(`/v1/gov/proposals/${TEST_PROPOSAL_ID}`).expect(200)

    testBasicProposal(proposal)
  })

  test('Test get proposal detail with invalid proposal id', async () => {
    await agent.get(`/v1/gov/proposals/abcd`).expect(400)
  })

  test('Test get proposal detail with invalid accounts', async () => {
    await agent.get(`/v1/gov/proposals/${TEST_PROPOSAL_ID}?account=3443`).expect(400)
  })

  test('Test get proposal deposits', async () => {
    const { body } = await agent.get(`/v1/gov/proposals/${TEST_PROPOSAL_ID}/deposits`).expect(200)

    expect(body).toMatchObject({
      totalCnt: expect.any(Number),
      page: expect.any(Number),
      limit: expect.any(Number),
      deposits: expect.arrayContaining([
        {
          txhash: expect.any(String),
          deposit: expect.arrayContaining([coinObject]),
          depositor: {
            accountAddress: expect.any(String)
          }
        }
      ])
    })
  })

  test('Test get proposal votes', async () => {
    const { body } = await agent.get(`/v1/gov/proposals/${TEST_PROPOSAL_ID}/votes`).expect(200)
    testVote(body)
  })

  test('Test get proposal votes filtered by option', async () => {
    const { body } = await agent.get(`/v1/gov/proposals/${TEST_PROPOSAL_ID}/votes?option=Yes`).expect(200)
    testVote(body)
  })

  test('Test get no vote proposal', async () => {
    const { body } = await agent.get(`/v1/gov/proposals/${NO_VOTE_PROPOSAL_ID}/votes`).expect(200)

    expect(body.totalCnt).toBe(0)
    expect(body.votes).toBeArrayOfSize(0)
  })
})
