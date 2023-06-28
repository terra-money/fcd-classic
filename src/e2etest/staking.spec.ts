import 'jest-extended'
import { SuperTest, Test } from 'supertest'
import { setupAgent, terminateAPITest } from './lib/agent'

const ACCOUNT = 'terra12t890qauaz42ltzzx3rxj7gu74jvwmzw9659zn'
const VALIDATOR_DELEGATED = 'terravaloper1uymwfafhq8fruvcjq8k67a29nqzrxnv9m6m427'
const VALIDATOR_NOT_DELEGATED = 'terravaloper1qk46lk4kt4f90y4quv9mds0q26khhwdsjme29h'
const VALIDATOR_CLAIMED = 'terravaloper1mpmn2y9qw4dn6z2q3a7hy4c3wjztmvu7wz4r4u'

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
  delegatorShares: expect.any(String),
  description: {
    identity: expect.any(String),
    moniker: expect.any(String),
    website: expect.any(String),
    details: expect.any(String),
    profileIcon: expect.any(String)
  },
  operatorAddress: expect.any(String),
  rewardsPool: {
    total: expect.any(String),
    denoms: expect.arrayContaining([{ ...coinObject, adjustedAmount: expect.any(String) }])
  },
  selfDelegation: {
    amount: expect.any(String),
    weight: expect.any(String)
  },
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

describe('Staking', () => {
  let agent: SuperTest<Test>
  let connection

  beforeAll(async () => {
    ({ agent, connection } = await setupAgent())
  })

  afterAll(async () => {
    await terminateAPITest({ connection })
  })

  test('staking info for account', async () => {
    const { body } = await agent.get(`/v1/staking/account/${ACCOUNT}`).expect(200)

    expect(body).toMatchObject({
      delegationTotal: expect.any(String),
      rewards: {
        total: expect.any(String),
        denoms: expect.arrayContaining([coinObject])
      },
      undelegations: expect.toBeArray()
    })

    expect(body.myDelegations).toIncludeAnyMembers([delegationObject])
  })

  test('get validators', async () => {
    const { body } = await agent.get(`/v1/staking/validators`).expect(200)
    expect(body[0]).toMatchObject(validatorObject)
  })

  test('get delegated validators', async () => {
    const { body } = await agent.get(`/v1/staking/validators/${VALIDATOR_DELEGATED}?account=${ACCOUNT}`).expect(200)
    expect(body.myDelegation).toBeString()
    expect(body.myDelegatable).toBeString()
  })

  test('get delegated validators with invalid operator address', async () => {
    await agent.get(`/v1/staking/validators/${ACCOUNT}?account=${ACCOUNT}`).expect(400)
  })

  test('get validator not delegated', async () => {
    const { body } = await agent.get(`/v1/staking/validators/${VALIDATOR_NOT_DELEGATED}?account=${ACCOUNT}`).expect(200)

    expect(body).toMatchObject(validatorObject)
  })

  test(`get validator's claims`, async () => {
    const { body } = await agent.get(`/v1/staking/validators/${VALIDATOR_CLAIMED}/claims`).expect(200)

    expect(body).toMatchObject({
      limit: expect.any(Number),
      claims: expect.arrayContaining([
        {
          chainId: expect.any(String),
          txhash: expect.any(String),
          type: expect.any(String),
          amounts: expect.arrayContaining([coinObject]),
          timestamp: expect.any(String)
        }
      ])
    })
  })

  test('return of all', async () => {
    await agent.get('/v1/staking/return').expect(200)
  })

  test('return of one', async () => {
    await agent.get(`/v1/staking/return/${VALIDATOR_DELEGATED}`).expect(200)
  })
})
