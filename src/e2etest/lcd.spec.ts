import 'jest-extended'
import * as lcd from 'lib/lcd'

const VALID_BLOCK_HEIGHT = '13225000'

const UNKNOWN_TX_HASH = '0C7A5F320FD3B91CEC2BEBDF539E8B71E1C120B04F95DEF6FB09EEBF9552391B'
const VALID_TX_HASH = 'CB3BB96B3B201B738BB87220883289D2D892C2021E6E403F4F406DC687C1FA4D'

const UNKNOWN_TERRA_ADDRESS = 'terra12c5s58hnc3c0pjr5x7u68upsgzg2r8fwq5nlsy'
const VALID_TERRA_ADDRESS = 'terra12t890qauaz42ltzzx3rxj7gu74jvwmzw9659zn'

const UNKNOWN_VALOPER_ADDRESS = 'terravaloper1uwgg244kechjgqdyr9kyxtt7yyj5zqcugvna2d'
const VALID_VALOPER_ADDRESS = 'terravaloper1uymwfafhq8fruvcjq8k67a29nqzrxnv9m6m427'
// const VALID_VALCONSPUB_ADDRESS = 'terravalconspub1zcjduepqwgwyky5375uk0llhwf0ya5lmwy4up838jevfh3pyzf5s3hd96xjslnexul'

const coinObject = {
  denom: expect.any(String),
  amount: expect.any(String)
}

const validatorObject = {
  commission: {
    commission_rates: {
      max_change_rate: expect.any(String),
      max_rate: expect.any(String),
      rate: expect.any(String)
    },
    update_time: expect.any(String)
  },
  consensus_pubkey: {
    '@type': expect.any(String),
    key: expect.any(String)
  },
  delegator_shares: expect.any(String),
  description: {
    details: expect.any(String),
    identity: expect.any(String),
    moniker: expect.any(String),
    website: expect.any(String)
  },
  jailed: expect.any(Boolean),
  min_self_delegation: expect.any(String),
  operator_address: expect.any(String),
  status: expect.any(String),
  tokens: expect.any(String),
  unbonding_height: expect.any(String),
  unbonding_time: expect.any(String)
}

describe('LCD', () => {
  test('getTx: invalid', async () => {
    await expect(lcd.getTx('blahblah')).toReject()
  })

  test('getTx: not found', async () => {
    await expect(lcd.getTx(UNKNOWN_TX_HASH)).toReject()
  })

  test('getTx: success', async () => {
    await expect(lcd.getTx(VALID_TX_HASH)).resolves.toMatchObject({
      txhash: VALID_TX_HASH
    })
  })

  test('getValidatorConsensus', async () => {
    await expect(lcd.getValidatorConsensus()).resolves.toContainEqual({
      address: expect.any(String),
      pub_key: {
        '@type': expect.any(String),
        key: expect.any(String)
      },
      proposer_priority: expect.any(String),
      voting_power: expect.any(String)
    })
  })

  test('getBlock: invalid', async () => {
    await expect(lcd.getBlock('0')).toReject()
  })

  test('getBlock: success', async () => {
    await expect(lcd.getBlock(VALID_BLOCK_HEIGHT)).resolves.toMatchObject({
      block: {}
    })
  })

  test('getLatestBlock', async () => {
    await expect(lcd.getLatestBlock()).toResolve()
  })

  test('getAccount: invalid', async () => {
    await expect(lcd.getAccount('1234')).toReject()
  })

  test('getAccount: not found', async () => {
    await expect(lcd.getAccount(UNKNOWN_TERRA_ADDRESS)).resolves.toBeUndefined()
  })

  test('getAccount: success', async () => {
    await expect(lcd.getAccount(VALID_TERRA_ADDRESS)).resolves.toMatchObject({
      address: VALID_TERRA_ADDRESS
    })
  })

  test('getBalance: success', async () => {
    await expect(lcd.getBalance(VALID_TERRA_ADDRESS)).resolves.toContainEqual(coinObject)
  })

  test('getDelegations: invalid', async () => {
    await expect(lcd.getDelegations('invalid')).toReject()
  })

  test('getDelegations: not found', async () => {
    await expect(lcd.getDelegations(UNKNOWN_TERRA_ADDRESS)).resolves.toBeArrayOfSize(0)
  })

  test('getDelegations: success', async () => {
    const delegations = await lcd.getDelegations(VALID_TERRA_ADDRESS)

    expect(delegations).toBeArray()

    const delegation = delegations.find((d) => d.delegation.delegator_address === VALID_TERRA_ADDRESS)

    expect(delegation).toMatchObject({
      balance: coinObject,
      delegation: {
        delegator_address: expect.any(String),
        shares: expect.any(String),
        validator_address: expect.any(String)
      }
    })
  })

  test('getValidatorDelegations: valid', async () => {
    await expect(lcd.getValidatorDelegations(VALID_VALOPER_ADDRESS)).resolves.toContainEqual({
      delegation: {
        delegator_address: expect.any(String),
        validator_address: expect.any(String),
        shares: expect.any(String)
      },
      balance: coinObject
    })
  })

  test('getDelegationForValidator: invalid', async () => {
    await expect(lcd.getDelegationForValidator(VALID_TERRA_ADDRESS, 'invalid')).toReject()
    await expect(lcd.getDelegationForValidator('invalid', VALID_VALOPER_ADDRESS)).toReject()
  })

  test('getDelegationForValidator: not found', async () => {
    await expect(lcd.getDelegationForValidator(VALID_TERRA_ADDRESS, UNKNOWN_VALOPER_ADDRESS)).resolves.toBeUndefined()
  })

  test('getDelegationForValidator: success', async () => {
    await expect(lcd.getDelegationForValidator(VALID_TERRA_ADDRESS, VALID_VALOPER_ADDRESS)).resolves.toMatchObject({
      delegation: {
        delegator_address: VALID_TERRA_ADDRESS,
        validator_address: VALID_VALOPER_ADDRESS,
        shares: expect.any(String)
      },
      balance: coinObject
    })
  })

  test('getUnbondingDelegations: invalid', async () => {
    await expect(lcd.getUnbondingDelegations('invalid')).toReject()
  })

  test('getUnbondingDelegations: not found', async () => {
    await expect(lcd.getUnbondingDelegations(VALID_TERRA_ADDRESS)).resolves.toBeArrayOfSize(0)
  })

  test('getUnbondingDelegations: pass', async () => {
    // TODO: Figure out how to test getUnbondingDelegation
  })

  test('getValidators', async () => {
    await expect(lcd.getValidators()).toResolve()
  })

  test('getValidators by status', async () => {
    await expect(lcd.getValidators('BOND_STATUS_BONDED')).resolves.not.toBeArrayOfSize(0)
  })

  test('getValidator: invalid', async () => {
    await expect(lcd.getValidator('invalid')).toReject()
  })

  test('getValidator: not found', async () => {
    await expect(lcd.getValidator(UNKNOWN_VALOPER_ADDRESS)).resolves.toBeUndefined()
  })

  test('getValidator: success', async () => {
    await expect(lcd.getValidator(VALID_VALOPER_ADDRESS)).resolves.toMatchObject(validatorObject)
  })

  test('getStakingPool', async () => {
    await expect(lcd.getStakingPool()).resolves.toMatchObject({
      not_bonded_tokens: expect.any(String),
      bonded_tokens: expect.any(String)
    })
  })

  test('getAllRewards: invalid', async () => {
    await expect(lcd.getTotalRewards('invalid')).toReject()
  })

  test('getAllRewards: not found', async () => {
    await expect(lcd.getTotalRewards(UNKNOWN_TERRA_ADDRESS)).resolves.toBeArrayOfSize(0)
  })

  test('getAllRewards: success', async () => {
    await expect(lcd.getTotalRewards(VALID_TERRA_ADDRESS)).resolves.toContainEqual(coinObject)
  })

  test('getRewards: invalid', async () => {
    await expect(lcd.getRewards(UNKNOWN_TERRA_ADDRESS, 'invalid')).toReject()
    await expect(lcd.getRewards('invalid', VALID_VALOPER_ADDRESS)).toReject()
  })

  test('getRewards: not found', async () => {
    await expect(lcd.getRewards(UNKNOWN_TERRA_ADDRESS, VALID_VALOPER_ADDRESS)).resolves.toBeArrayOfSize(0)
  })

  test('getRewards: success', async () => {
    await expect(lcd.getRewards(VALID_TERRA_ADDRESS, VALID_VALOPER_ADDRESS)).resolves.toContainEqual(coinObject)
  })

  test('getCommissions: invalid', async () => {
    await expect(lcd.getCommissions('invalid')).toReject()
  })

  test('getCommissions: not found', async () => {
    await expect(lcd.getCommissions(UNKNOWN_VALOPER_ADDRESS)).resolves.toBeArrayOfSize(0)
  })

  test('getCommissions: success', async () => {
    await expect(lcd.getCommissions(VALID_VALOPER_ADDRESS)).resolves.toContainEqual(coinObject)
  })

  test('getValidatorRewards: invalid', async () => {
    await expect(lcd.getValidatorRewards('invalid')).toReject()
  })

  test('getValidatorRewards: not found', async () => {
    await expect(lcd.getValidatorRewards(UNKNOWN_VALOPER_ADDRESS)).resolves.toBeArrayOfSize(0)
  })

  test('getValidatorRewards: success', async () => {
    await expect(lcd.getValidatorRewards(VALID_VALOPER_ADDRESS)).resolves.toContainEqual(coinObject)
  })

  test('getCommunityPool', async () => {
    await expect(lcd.getCommunityPool()).resolves.toContainEqual(coinObject)
  })

  test('getSwapResult: invalid', async () => {
    await expect(lcd.getSwapResult({ offer_coin: 'invalid', ask_denom: 'usdr' })).toReject()
  })

  test('getSwapResult: not found', async () => {
    await expect(lcd.getSwapResult({ offer_coin: '1000usdr', ask_denom: 'invalid' })).toReject()
  })

  test('getSwapResult: success', async () => {
    await expect(lcd.getSwapResult({ offer_coin: '1000usdr', ask_denom: 'uusd' })).resolves.toMatchObject(coinObject)
  })

  test('getOraclePrices: success', async () => {
    await expect(lcd.getOraclePrices()).resolves.toContainEqual({
      denom: expect.any(String),
      amount: expect.any(String)
    })
  })

  test('getOracleActives', async () => {
    await expect(lcd.getOracleActives()).resolves.toBeArray()
  })

  test('getActiveOraclePrices', async () => {
    await expect(lcd.getActiveOraclePrices()).toResolve()
  })

  test('getMissedOracleVotes: invalid', async () => {
    await expect(lcd.getMissedOracleVotes('invalid')).toReject()
  })

  test('getMissedOracleVotes: not found', async () => {
    await expect(lcd.getMissedOracleVotes(UNKNOWN_VALOPER_ADDRESS)).resolves.toBeString()
  })

  test('getMissedOracleVotes: success', async () => {
    await expect(lcd.getMissedOracleVotes(VALID_VALOPER_ADDRESS)).resolves.toBeString()
  })

  test('getTotalSupply', async () => {
    await expect(lcd.getTotalSupply()).resolves.toContainEqual(coinObject)
  })

  test('getAllActiveIssuance', async () => {
    await expect(lcd.getAllActiveIssuance()).resolves.toMatchObject({
      usdr: expect.any(String)
    })
  })

  test('getTaxProceeds', async () => {
    await expect(lcd.getTaxProceeds()).resolves.toBeArray()
  })

  test('getSeigniorageProceeds', async () => {
    await expect(lcd.getSeigniorageProceeds()).resolves.toBeString()
  })

  test('getTaxRate', async () => {
    await expect(lcd.getTaxRate()).resolves.toBeString()
  })

  test('getTaxCap', async () => {
    await expect(lcd.getTaxCap('usdr')).resolves.toBe('1000000')
  })

  test('getTaxCaps', async () => {
    await expect(lcd.getTaxCaps()).resolves.toContainEqual({
      denom: expect.any(String),
      tax_cap: expect.any(String)
    })
  })
})
