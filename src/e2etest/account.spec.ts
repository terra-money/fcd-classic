import 'jest-extended'
import { SuperTest, Test } from 'supertest'
import { setupAgent, terminateAPITest } from './lib/agent'
import { BOND_DENOM } from 'lib/constant'

const NORMAL_ACCOUNT = 'terra12t890qauaz42ltzzx3rxj7gu74jvwmzw9659zn'
const VESTING_ACCOUNT = 'terra1dp0taj85ruc299rkdvzp4z5pfg6z6swaed74e6'

describe('Account', () => {
  let agent: SuperTest<Test>
  let connection

  beforeAll(async () => {
    ({ agent, connection } = await setupAgent())
  })

  afterAll(async () => {
    await terminateAPITest({ connection })
  })

  test('invalid address', async () => {
    await agent.get(`/v1/bank/${NORMAL_ACCOUNT}@$`).expect(400)
  })

  test('normal account', async () => {
    const { body } = await agent.get(`/v1/bank/${NORMAL_ACCOUNT}`).expect(200)
    const balances: Balance[] = [
      {
        denom: BOND_DENOM,
        available: expect.any(String),
        delegatedVesting: '0',
        delegatable: expect.any(String),
        freedVesting: '0',
        unbonding: '0',
        remainingVesting: '0'
      },
      {
        denom: 'ukrw',
        available: expect.any(String),
        delegatedVesting: '0',
        delegatable: '0',
        freedVesting: '0',
        unbonding: '0',
        remainingVesting: '0'
      }
    ]

    expect(body.balance).toIncludeAllMembers(balances)
    expect(body.vesting).toBeDefined()
    expect(body.delegations).toBeDefined()
    expect(body.unbondings).toBeDefined()
  })

  test('vesting account', async () => {
    const { body } = await agent.get(`/v1/bank/${VESTING_ACCOUNT}`).expect(200)

    expect(body.vesting).toContainEqual({
      denom: 'usdr',
      schedules: expect.toContainValue({
        amount: expect.any(String),
        endTime: expect.any(Number),
        freedRate: expect.any(Number),
        ratio: expect.any(Number),
        startTime: expect.any(Number)
      }),
      total: expect.any(String)
    })
  })
})
