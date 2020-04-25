import 'jest-extended'
import { SuperTest, Test } from 'supertest'
import { setupAgent, terminateAPITest } from './lib/agent'

const ACCOUNT = 'terra1940nsxkz62snd3azk3a9j79m4qd3qvwnrf2xvj'
const VALIDATOR_DELEGATED = 'terravaloper1pdx498r0hrc2fj36sjhs8vuhrz9hd2cw0yhqtk'
const VALIDATOR_NOT_DELEGATED = 'terravaloper10993luwlar59q7syh7t3hhk0kmtee645vlatfl'
const VALIDATOR_CLAIMED = 'terravaloper1pdx498r0hrc2fj36sjhs8vuhrz9hd2cw0yhqtk'

const coinObject = {
  denom: expect.any(String),
  amount: expect.any(String)
}

const validatorObject = {
  accountAddress: expect.any(String),
  commissionInfo: {
    rate: expect.any(String),
    maxRate: expect.any(String),
    maxChangeRate: expect.any(String),
    updateTime: expect.any(String)
  },
  consensusPubkey: expect.any(String),
  delegatorShares: expect.any(String),
  description: {
    identity: expect.any(String),
    moniker: expect.any(String),
    website: expect.any(String),
    details: expect.any(String),
    profileIcon: expect.any(String)
  },
  isNewValidator: expect.any(Boolean),
  operatorAddress: expect.any(String),
  rewardsPool: {
    total: expect.any(String),
    denoms: expect.arrayContaining([{ ...coinObject, adjustedAmount: expect.any(String) }])
  },
  selfDelegation: {
    amount: expect.any(String),
    weight: expect.any(String)
  },
  stakingReturn: expect.any(String),
  status: expect.any(String),
  tokens: expect.any(String),
  upTime: expect.any(Number),
  votingPower: {
    amount: expect.any(String),
    weight: expect.any(String)
  }
}

const delegationObject = {
  validatorName: expect.any(String), // delegated validators name (moniker)
  validatorAddress: expect.any(String), // validator address
  validatorStatus: expect.any(String), // validator status
  amountDelegated: expect.any(String), // delegated amount
  rewards: expect.arrayContaining([coinObject]), // rewards by denoms
  totalReward: expect.any(String) // total rewards
}

jest.mock('request-promise-native')

describe('Staking', () => {
  let agent: SuperTest<Test>
  let connection

  beforeAll(async () => {
    ;({ agent, connection } = await setupAgent())
  })

  afterAll(async () => {
    await terminateAPITest({ connection })
  })

  test('get staking info', async () => {
    const { body } = await agent.get(`/v1/staking/${ACCOUNT}`).expect(200)

    expect(body).toMatchObject({
      delegationTotal: expect.any(String),
      rewards: {
        total: expect.any(String),
        denoms: expect.arrayContaining([coinObject])
      },
      undelegations: expect.toBeArray()
    })

    expect(body.validators).toIncludeAnyMembers([
      {
        ...validatorObject,
        myDelegation: expect.any(String),
        myUndelegation: expect.toBeArray()
      }
    ])
    expect(body.myDelegations).toIncludeAnyMembers([delegationObject])
  })

  test('get validators', async () => {
    const { body } = await agent.get(`/v1/staking/validators`).expect(200)
    expect(body).toIncludeAnyMembers([validatorObject])
  })

  test('get delegated validators', async () => {
    const { body } = await agent.get(`/v1/staking/validators/${VALIDATOR_DELEGATED}?account=${ACCOUNT}`).expect(200)
    expect(body.myDelegation).toBeString()
    expect(body.myDelegatable).toBeString()
  })

  test('get delegated validators with invalid operator address', async () => {
    await agent.get(`/v1/staking/validators/${ACCOUNT}?account=${ACCOUNT}`).expect(400)
  })

  test('get validator not delegated ', async () => {
    const { body } = await agent.get(`/v1/staking/validators/${VALIDATOR_NOT_DELEGATED}?account=${ACCOUNT}`).expect(200)

    expect(body).toMatchObject(validatorObject)
  })

  test(`get validator's delegations`, async () => {
    const { body } = await agent.get(`/v1/staking/validators/${VALIDATOR_DELEGATED}/delegations`).expect(200)

    expect(body).toMatchObject({
      totalCnt: expect.any(Number),
      page: expect.any(Number),
      limit: expect.any(Number),
      events: expect.arrayContaining([
        {
          height: expect.any(String),
          type: expect.any(String),
          amount: coinObject,
          timestamp: expect.any(String)
        }
      ])
    })
  })

  test(`get validator's claims`, async () => {
    const { body } = await agent.get(`/v1/staking/validators/${VALIDATOR_CLAIMED}/claims`).expect(200)

    expect(body).toMatchObject({
      totalCnt: expect.any(Number),
      page: expect.any(Number),
      limit: expect.any(Number),
      claims: expect.arrayContaining([
        {
          tx: expect.any(String),
          type: expect.any(String),
          amounts: expect.arrayContaining([coinObject]),
          timestamp: expect.any(String)
        }
      ])
    })
  })

  test(`get validator's delegators`, async () => {
    const { body } = await agent.get(`/v1/staking/validators/${VALIDATOR_DELEGATED}/delegators?limit=50`).expect(200)

    expect(body).toMatchObject({
      totalCnt: expect.any(Number),
      page: expect.any(Number),
      limit: expect.any(Number),
      delegators: expect.arrayContaining([
        {
          address: expect.any(String),
          amount: expect.any(String),
          weight: expect.any(String)
        }
      ])
    })
  })

  test('staking return', async () => {
    const { body } = await agent.get('/v1/staking/return').expect(200)
  })

  test('staking return of validator', async () => {
    const { body } = await agent.get(`/v1/staking/return/${VALIDATOR_DELEGATED}`).expect(200)
  })

  test('Staking for all validators', async () => {
    const { body } = await agent.get('/v1/staking').expect(200)

    expect(body.validators).not.toBeArrayOfSize(0)
    expect(body.validators[0]).toMatchObject(validatorObject)
  })
})
