import 'jest-extended'
import * as lcd from 'lib/lcd'

const UNKNOWN_TX_HASH = '0C7A5F320FD3B91CEC2BEBDF539E8B71E1C120B04F95DEF6FB09EEBF9552391B'
const VALID_TX_HASH = 'ED3EA0E1AA684546B8FC1CA57625688876A6DD7C9DF283FCAE271128C52A5D14'

const UNKNOWN_TERRA_ADDRESS = 'terra12c5s58hnc3c0pjr5x7u68upsgzg2r8fwq5nlsy'
const VALID_TERRA_ADDRESS = 'terra1dcegyrekltswvyy0xy69ydgxn9x8x32zdtapd8'

const UNKNOWN_VALOPER_ADDRESS = 'terravaloper1uwgg244kechjgqdyr9kyxtt7yyj5zqcugvna2d'
const VALID_VALOPER_ADDRESS = 'terravaloper1dcegyrekltswvyy0xy69ydgxn9x8x32zdy3ua5'
const VALID_VALTERRA_ADDRESS = 'terra1dcegyrekltswvyy0xy69ydgxn9x8x32zdtapd8'
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
    type: expect.any(String),
    value: expect.any(String)
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
  status: expect.any(Number),
  tokens: expect.any(String),
  unbonding_height: expect.any(String),
  unbonding_time: expect.any(String)
}

const basicProposalObject = {
  content: {
    type: expect.any(String),
    value: {
      title: expect.any(String),
      description: expect.any(String)
    }
  },
  id: expect.any(String),
  status: expect.any(Number),
  final_tally_result: {
    yes: expect.any(String),
    abstain: expect.any(String),
    no: expect.any(String),
    no_with_veto: expect.any(String)
  },
  submit_time: expect.any(String),
  deposit_end_time: expect.any(String),
  total_deposit: expect.toBeArray(),
  voting_start_time: expect.any(String),
  voting_end_time: expect.any(String)
}

describe('LCD', () => {
  test('getTx: invalid', async () => {
    await expect(lcd.getTx('blahblah')).toReject()
  })

  test('getTx: not found', async () => {
    await expect(lcd.getTx(UNKNOWN_TX_HASH)).resolves.toBeUndefined()
  })

  test('getTx: success', async () => {
    await expect(lcd.getTx(VALID_TX_HASH)).resolves.toMatchObject({
      txhash: VALID_TX_HASH
    })
  })

  test('getValidatorConsensus', async () => {
    await expect(lcd.getValidatorConsensus()).resolves.toContainEqual({
      address: expect.any(String),
      pub_key: expect.any(String),
      proposer_priority: expect.any(String),
      voting_power: expect.any(String)
    })
  })

  test('getBlock: invalid', async () => {
    await expect(lcd.getBlock('0')).toReject()
  })

  test('getBlock: not found', async () => {
    await expect(lcd.getBlock(Number.MAX_SAFE_INTEGER.toString())).resolves.toBeUndefined()
  })

  test('getBlock: success', async () => {
    await expect(lcd.getBlock('1')).resolves.toMatchObject({
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
    await expect(lcd.getAccount(UNKNOWN_TERRA_ADDRESS)).resolves.toMatchObject({
      value: {
        account_number: '0'
      }
    })
  })

  test('getAccount: success', async () => {
    await expect(lcd.getAccount(VALID_VALTERRA_ADDRESS)).resolves.toMatchObject({
      value: {
        address: VALID_VALTERRA_ADDRESS
      }
    })
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

  test('getDelegationForValidator: invalid', async () => {
    await expect(lcd.getDelegationForValidator(VALID_TERRA_ADDRESS, 'invalid')).toReject()
    await expect(lcd.getDelegationForValidator('invalid', VALID_VALOPER_ADDRESS)).toReject()
  })

  test('getDelegationForValidator: not found', async () => {
    await expect(
      lcd.getDelegationForValidator(VALID_TERRA_ADDRESS, 'terravaloper1rhrptnx87ufpv62c7ngt9yqlz2hr77xr9nkcr9')
    ).resolves.toBeUndefined()
  })

  test('getDelegationForValidator: success', async () => {
    await expect(lcd.getDelegationForValidator(VALID_TERRA_ADDRESS, VALID_VALOPER_ADDRESS)).resolves.toMatchObject({
      balance: coinObject,
      delegator_address: VALID_TERRA_ADDRESS,
      shares: expect.any(String),
      validator_address: VALID_VALOPER_ADDRESS
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
    await expect(lcd.getValidators('bonded')).resolves.not.toBeArrayOfSize(0)
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

  test('getValidatorDelegations: invalid', async () => {
    await expect(lcd.getValidatorDelegations('invalid')).toReject()
  })

  test('getValidatorDelegations: not found', async () => {
    await expect(lcd.getValidatorDelegations(UNKNOWN_VALOPER_ADDRESS)).resolves.toBeArrayOfSize(0)
  })

  test('getValidatorDelegations: success', async () => {
    const delegations = await lcd.getValidatorDelegations(VALID_VALOPER_ADDRESS)

    expect(delegations).not.toBeArrayOfSize(0)
    expect(delegations[0]).toMatchObject({
      balance: coinObject,
      delegator_address: expect.any(String),
      shares: expect.any(String),
      validator_address: expect.any(String)
    })
  })

  test('getStakingPool', async () => {
    await expect(lcd.getStakingPool()).resolves.toMatchObject({
      not_bonded_tokens: expect.any(String),
      bonded_tokens: expect.any(String)
    })
  })

  describe('governance', () => {
    let proposal

    beforeAll(async () => {
      const proposals = await lcd.getProposals()

      expect(proposals).toBeArray()

      proposal = proposals.find(
        (p) =>
          p.content.type === 'params/ParameterChangeProposal' &&
          p.content.value.changes &&
          p.content.value.changes[0].subspace === 'staking'
      )

      expect(proposal).not.toBeNil()
    })

    test('getProposals', async () => {
      const proposals = await lcd.getProposals()

      expect(proposals).not.toBeArrayOfSize(0)
      expect(proposals[0]).toMatchObject(basicProposalObject)
    })

    test('getProposal', async () => {
      expect(proposal).toMatchObject(basicProposalObject)
      expect(proposal.content.value.changes).not.toBeArrayOfSize(0)

      if (proposal.content.value.changes) {
        expect(proposal.content.value.changes[0]).toMatchObject({
          subspace: expect.any(String),
          key: expect.any(String),
          value: expect.any(String)
        })
      }
    })

    test('getProposalProposer: invalid', async () => {
      await expect(lcd.getProposalProposer('invalid')).toReject()
    })

    test('getProposalProposer: not found', async () => {
      await expect(lcd.getProposalProposer(`${Number.MAX_SAFE_INTEGER}`)).resolves.toBeUndefined()
    })

    test('getProposalProposer: success', async () => {
      await expect(lcd.getProposalProposer(proposal.id)).resolves.toMatchObject({
        proposal_id: proposal.id,
        proposer: expect.any(String)
      })
    })

    test('getProposalDeposits: invalid / not found', async () => {
      await expect(lcd.getProposalDeposits(`${Number.MAX_SAFE_INTEGER}`)).resolves.toBeEmpty()
    })

    test('getProposalDeposits: success', async () => {
      await expect(lcd.getProposalDeposits(proposal.id)).resolves.not.toBeArrayOfSize(0)
    })

    test('getProposalVotes: invalid / not found', async () => {
      await expect(lcd.getProposalVotes(`${Number.MAX_SAFE_INTEGER}`)).resolves.toBeEmpty()
    })

    test('getProposalVotes: success', async () => {
      await expect(lcd.getProposalVotes(proposal.id)).resolves.not.toBeArrayOfSize(0)
    })

    test('getProposalVotes: invalid', async () => {
      await expect(lcd.getProposalVotes('invalid')).toReject()
    })

    test('getProposalVotes: success', async () => {
      const votes = await lcd.getProposalVotes(proposal.id)

      expect(votes).not.toBeArrayOfSize(0)

      if (votes.length) {
        expect(votes[0]).toMatchObject({
          option: expect.any(String),
          proposal_id: proposal.id,
          voter: expect.any(String)
        })
      }
    })

    test('getProposalTally: invalid', async () => {
      await expect(lcd.getProposalVotes('invalid')).toReject()
    })

    test('getProposalTally: success', async () => {
      await expect(lcd.getProposalTally(proposal.id)).resolves.toMatchObject({
        abstain: expect.any(String),
        no: expect.any(String),
        no_with_veto: expect.any(String),
        yes: expect.any(String)
      })
    })

    test('getProposalDepositParams', async () => {
      await expect(lcd.getProposalDepositParams()).resolves.toMatchObject({
        max_deposit_period: expect.any(String),
        min_deposit: expect.arrayContaining([coinObject])
      })
    })

    test('getProposalVotingParams', async () => {
      await expect(lcd.getProposalVotingParams()).resolves.toMatchObject({
        voting_period: expect.any(String)
      })
    })

    test('getProposalTallyingParams', async () => {
      await expect(lcd.getProposalTallyingParams()).resolves.toMatchObject({
        quorum: expect.any(String),
        threshold: expect.any(String),
        veto: expect.any(String)
      })
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
    await expect(lcd.getCommissions(UNKNOWN_VALOPER_ADDRESS)).resolves.toBeUndefined()
  })

  test('getCommissions: success', async () => {
    await expect(lcd.getCommissions(VALID_VALOPER_ADDRESS)).resolves.toMatchObject({
      operator_address: VALID_VALTERRA_ADDRESS,
      self_bond_rewards: expect.arrayContaining([coinObject]),
      val_commission: {
        commision: expect.arrayContaining([coinObject])
      }
    })
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
