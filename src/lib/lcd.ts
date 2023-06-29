import { request, Agent } from 'undici'
import config from 'config'
import { pick, pickBy } from 'lodash'
import { plus, times, div, getIntegerPortion } from 'lib/math'
import { ErrorTypes, APIError } from './error'
import { BOND_DENOM } from './constant'

const agent = new Agent({
  connect: {
    rejectUnauthorized: false
  }
})

const NOT_FOUND_REGEX = /(?:not found|no dele|not exist|failed to find|unknown prop|empty bytes|No price reg)/i

async function get(path: string, params?: Record<string, unknown>): Promise<any> {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'terra-fcd'
    },
    dispatcher: agent
  }

  let url = `${config.LCD_URI}${path}`
  params && Object.keys(params).forEach((key) => params[key] === undefined && delete params[key])
  const qs = new URLSearchParams(params as any).toString()
  if (qs.length) {
    url += `?${qs}`
  }

  const res = await request(url, options).then(async (res) => {
    const json = await res.body.json()

    if (res.statusCode >= 400 && json.message && NOT_FOUND_REGEX.test(json.message)) {
      return undefined
    }

    if (res.statusCode === 400) {
      throw new APIError(
        ErrorTypes.INVALID_REQUEST_ERROR,
        res.statusCode.toString(),
        `${json.message} (status: ${res.statusCode}, url: ${url})`
      )
    }

    if (res.statusCode !== 200) {
      throw new APIError(ErrorTypes.LCD_ERROR, res.statusCode.toString(), `${json.message} (url: ${url})`, json)
    }

    return json
  })

  if (res?.height && res.result !== undefined) {
    return res.result
  }

  return res
}

// NOTE: height parameter depends on node's configuration
// The default is: PruneDefault defines a pruning strategy where the last 100 heights are kept
// in addition to every 100th and where to-be pruned heights are pruned at every 10th height.
function calculateHeightParam(strHeight?: string): string | undefined {
  const numHeight = Number(strHeight)

  if (!numHeight) {
    return undefined
  }

  if (
    latestHeight &&
    (latestHeight < config.INITIAL_HEIGHT + config.PRUNING_KEEP_EVERY || // Pruning not happened yet
      latestHeight - numHeight < config.PRUNING_KEEP_EVERY) // Last 100 heights are guarenteed
  ) {
    return strHeight
  }

  return Math.max(
    config.INITIAL_HEIGHT,
    numHeight + (config.PRUNING_KEEP_EVERY - (numHeight % config.PRUNING_KEEP_EVERY))
  ).toString()
}

///////////////////////////////////////////////
// Transactions
///////////////////////////////////////////////
export function convertProtoType(protoType: string): string {
  // '/terra.oracle.v1beta1.MsgAggregateExchangeRatePrevote' ->
  // [ 'terra', 'oracle', 'v1beta1', 'MsgAggregateExchangeRatePrevote' ]
  const tokens = protoType.match(/([a-zA-Z0-9]+)/g)

  if (!tokens) {
    return protoType
  }

  let type: string

  if (tokens[0] === 'terra' || tokens[0] === 'cosmos') {
    type = `${tokens[1]}/${tokens[tokens.length - 1]}`
  } else {
    type = `${tokens[0]}/${tokens[tokens.length - 1]}`
  }

  type = type
    .replace('distribution/MsgSetWithdrawAddress', 'distribution/MsgModifyWithdrawAddress')
    .replace('distribution/MsgWithdrawDelegatorReward', 'distribution/MsgWithdrawDelegationReward')
    .replace('authz/MsgGrant', 'msgauth/MsgGrantAuthorization')
    .replace('authz/MsgRevoke', 'msgauth/MsgRevokeAuthorization')
    .replace('authz/MsgExec', 'msgauth/MsgExecAuthorized')
    .replace('ibc/MsgTransfer', 'cosmos-sdk/MsgTransfer')

  return type
}

export async function getTx(hash: string): Promise<Transaction.LcdTransaction | undefined> {
  const res = await get(`/cosmos/tx/v1beta1/txs/${hash}`)

  if (!res || !res.tx_response) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR, '', `transaction not found on node (hash: ${hash})`)
  }

  const intermediate = pickBy(
    pick(res.tx_response, [
      'height',
      'txhash',
      'logs',
      'gas_wanted',
      'gas_used',
      'codespace',
      'code',
      'timestamp',
      'raw_log'
    ])
  ) as Pick<
    Transaction.LcdTransaction,
    'height' | 'txhash' | 'logs' | 'gas_wanted' | 'gas_used' | 'codespace' | 'code' | 'timestamp' | 'raw_log'
  >

  const { auth_info, body, signatures } = res.tx_response.tx

  return {
    ...intermediate,
    tx: {
      type: 'core/StdTx',
      value: {
        fee: {
          amount: auth_info.fee.amount,
          gas: auth_info.fee.gas_limit
        },
        msg: body.messages.map((m) => {
          const type = convertProtoType(m['@type'])

          return {
            type,
            value: pick(
              m,
              Object.keys(m).filter((key) => key !== '@type')
            )
          }
        }),
        signatures: auth_info.signer_infos.map((si, idx) => ({
          pub_key: {
            type: 'tendermint/PubKeySecp256k1',
            value: si.public_key?.key || null
          },
          signature: signatures[idx]
        })),
        memo: body.memo,
        timeout_height: body.timeout_height
      }
    }
  }
}

///////////////////////////////////////////////
// Tendermint RPC
///////////////////////////////////////////////
export async function getValidatorConsensus(strHeight?: string): Promise<LcdValidatorConsensus[]> {
  const height = calculateHeightParam(strHeight)
  const {
    validators,
    pagination
  }: {
    validators: LcdValidatorConsensus[]
    pagination: Pagination
  } = await get(`/cosmos/base/tendermint/v1beta1/validatorsets/${height || 'latest'}`)

  const result = [validators]
  let total = parseInt(pagination.total) - 100
  let offset = 100

  while (total > 0) {
    const {
      validators
    }: {
      validators: LcdValidatorConsensus[]
    } = await get(`/cosmos/base/tendermint/v1beta1/validatorsets/${height || 'latest'}`, {
      'pagination.offset': offset
    })

    result.push(validators)
    offset += 100
    total -= 100
  }

  return result.flat()
}

// ExtendedValidator includes validator with extra informations
export interface ExtendedValidator {
  lcdValidator: LcdValidator
  lcdConsensus?: LcdValidatorConsensus
  votingPower: string
  votingPowerWeight: string
}

export async function getValidatorsAndConsensus(
  status?: LcdValidatorStatus,
  strHeight?: string
): Promise<ExtendedValidator[]> {
  const [validators, validatorConsensus] = await Promise.all([
    getValidators(status, strHeight),
    getValidatorConsensus(strHeight)
  ])
  const totalVotingPower = validatorConsensus.reduce((acc, consVal) => plus(acc, consVal.voting_power), '0')

  return validators.reduce<ExtendedValidator[]>((prev, lcdValidator) => {
    const lcdConsensus = validatorConsensus.find((consVal) => consVal.pub_key.key === lcdValidator.consensus_pubkey.key)

    prev.push({
      lcdValidator,
      lcdConsensus,
      votingPower: lcdConsensus ? times(lcdConsensus.voting_power, 1000000) : '0.0',
      votingPowerWeight: lcdConsensus ? div(lcdConsensus.voting_power, totalVotingPower) : '0.0'
    })

    return prev
  }, [])
}

export function getBlock(height: string): Promise<LcdBlock> {
  return get(`/cosmos/base/tendermint/v1beta1/blocks/${height}`)
}

// Store latestHeight for later use
let latestHeight = 0

export function getLatestBlock(): Promise<LcdBlock> {
  return get(`/cosmos/base/tendermint/v1beta1/blocks/latest`).then((latestBlock) => {
    if (latestBlock?.block) {
      latestHeight = Number(latestBlock.block.header.height)
    }

    return latestBlock
  })
}

///////////////////////////////////////////////
// Auth & Bank
///////////////////////////////////////////////
export async function getAccount(address: string): Promise<AllAccount | undefined> {
  return (await get(`/cosmos/auth/v1beta1/accounts/${address}`))?.account
}

export async function getBalance(address: string): Promise<Coin[]> {
  return (await get(`/cosmos/bank/v1beta1/balances/${address}`)).balances
}

export async function getTotalSupply(strHeight?: string): Promise<Coin[]> {
  return (
    await get('/cosmos/bank/v1beta1/supply', { height: calculateHeightParam(strHeight), 'pagination.limit': 100000 })
  ).supply
}

export async function getAllActiveIssuance(strHeight?: string): Promise<{ [denom: string]: string }> {
  return (await getTotalSupply(strHeight)).reduce((acc, item) => {
    acc[item.denom] = item.amount
    return acc
  }, {})
}

///////////////////////////////////////////////
// Staking
///////////////////////////////////////////////
export async function getDelegations(delegator: string): Promise<LcdStakingDelegation[]> {
  const res = await get(`/cosmos/staking/v1beta1/delegations/${delegator}`)
  return res?.delegation_responses || []
}

export async function getValidatorDelegations(
  validator: string,
  limit = 100,
  next = ''
): Promise<LcdStakingDelegation[]> {
  const res = await get(`/cosmos/staking/v1beta1/validators/${validator}/delegations`, {
    'pagination.limit': limit,
    'pagination.next_key': next
  })
  return res?.delegation_responses || []
}

export async function getDelegationForValidator(
  delegator: string,
  validator: string
): Promise<LcdStakingDelegation | undefined> {
  const res = await get(`/cosmos/staking/v1beta1/validators/${validator}/delegations/${delegator}`)
  return res?.delegation_response
}

export async function getUnbondingDelegations(address: string): Promise<LcdStakingUnbonding[]> {
  const res = await get(`/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`)
  return res?.unbonding_responses || []
}

export async function getValidators(status?: LcdValidatorStatus, strHeight?: string): Promise<LcdValidator[]> {
  const height = calculateHeightParam(strHeight)

  if (status) {
    return (await get(`/cosmos/staking/v1beta1/validators`, { status, height, 'pagination.limit': 200 })).validators
  }

  const url = `/cosmos/staking/v1beta1/validators`

  const [bonded, unbonded, unbonding] = await Promise.all([
    get(url, { status: 'BOND_STATUS_BONDED', height, 'pagination.limit': 200 }),
    get(url, { status: 'BOND_STATUS_UNBONDING', height }),
    get(url, { status: 'BOND_STATUS_UNBONDED', height })
  ])

  return [bonded.validators, unbonded.validators, unbonding.validators].flat()
}

export async function getValidator(operatorAddr: string): Promise<LcdValidator | undefined> {
  const res = await get(`/cosmos/staking/v1beta1/validators/${operatorAddr}`)
  return res?.validator
}

export async function getStakingPool(strHeight?: string): Promise<LcdStakingPool> {
  return (await get(`/cosmos/staking/v1beta1/pool`, { height: calculateHeightParam(strHeight) })).pool
}

export async function getRedelegations(delegator: string): Promise<LCDStakingRelegation[]> {
  return (await get(`/cosmos/staking/v1beta1/delegators/${delegator}/redelegations`)).redelegation_responses
}

///////////////////////////////////////////////
// Distribution
///////////////////////////////////////////////
function rewardMapper(reward): Coin {
  return {
    denom: reward.denom,
    amount: getIntegerPortion(reward.amount)
  }
}

function rewardFilter(reward) {
  return reward.amount > 0
}

export async function getTotalRewards(delegatorAddress: string): Promise<Coin[]> {
  const rewards = await get(`/cosmos/distribution/v1beta1/delegators/${delegatorAddress}/rewards`)
  return (rewards.total || []).map(rewardMapper).filter(rewardFilter)
}

export async function getRewards(delegatorAddress: string, validatorOperAddress: string): Promise<Coin[]> {
  const rewards =
    (await get(`/cosmos/distribution/v1beta1/delegators/${delegatorAddress}/rewards/${validatorOperAddress}`))
      ?.rewards || []
  return rewards.map(rewardMapper).filter(rewardFilter)
}

export async function getCommissions(validatorAddress: string): Promise<Coin[]> {
  return (
    (await get(`/cosmos/distribution/v1beta1/validators/${validatorAddress}/commission`)).commission.commission || []
  )
}

export async function getValidatorRewards(validatorAddress: string): Promise<Coin[]> {
  return (
    (await get(`/cosmos/distribution/v1beta1/validators/${validatorAddress}/outstanding_rewards`)).rewards.rewards || []
  )
}

export async function getCommunityPool(strHeight?: string): Promise<Coin[] | null> {
  return (await get(`/cosmos/distribution/v1beta1/community_pool`, { height: calculateHeightParam(strHeight) })).pool
}

///////////////////////////////////////////////
// Wasm
///////////////////////////////////////////////
export async function getContractStore(
  contractAddress: string,
  data: Object,
  strHeight?: string
): Promise<Record<string, unknown>> {
  const base64 = Buffer.from(JSON.stringify(data), 'base64').toString()

  return get(`/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${base64}}`, {
    height: calculateHeightParam(strHeight)
  })
}

///////////////////////////////////////////////
// Market
///////////////////////////////////////////////
export async function getSwapResult(params: { offer_coin: string; ask_denom: string }): Promise<Coin | undefined> {
  return (await get(`/terra/market/v1beta1/swap`, params)).return_coin
}

///////////////////////////////////////////////
// Oracle
///////////////////////////////////////////////
export async function getOraclePrices(strHeight?: string): Promise<Coin[]> {
  return (
    (await get(`/terra/oracle/v1beta1/denoms/exchange_rates`, { height: calculateHeightParam(strHeight) }))
      .exchange_rates || []
  )
}

export async function getOracleActives(): Promise<string[]> {
  return (await get(`/terra/oracle/v1beta1/denoms/actives`)).actives
}

export async function getActiveOraclePrices(strHeight?: string): Promise<DenomMap> {
  return (await getOraclePrices(strHeight)).filter(Boolean).reduce((prev, item) => {
    if (item) {
      prev[item.denom] = item.amount
    }

    return prev
  }, {})
}

// non-existent addresses will always return "0"
export async function getMissedOracleVotes(operatorAddr: string): Promise<string> {
  return (await get(`/terra/oracle/v1beta1/validators/${operatorAddr}/miss`)).miss_counter
}

///////////////////////////////////////////////
// Treasury
///////////////////////////////////////////////
export async function getTaxProceeds(strHeight?: string): Promise<Coin[]> {
  return (
    (await get(`/terra/treasury/v1beta1/tax_proceeds`, { height: calculateHeightParam(strHeight) })).tax_proceeds || []
  )
}

export async function getSeigniorageProceeds(strHeight?: string): Promise<string> {
  return (await get(`/terra/treasury/v1beta1/seigniorage_proceeds`, { height: calculateHeightParam(strHeight) }))
    .seigniorage_proceeds
}

export async function getTaxRate(strHeight?: string): Promise<string> {
  return (await get(`/terra/treasury/v1beta1/tax_rate`, { height: calculateHeightParam(strHeight) })).tax_rate
}

export async function getTaxCap(denom: string, strHeight?: string): Promise<string> {
  return (await get(`/terra/treasury/v1beta1/tax_caps/${denom}`, { height: calculateHeightParam(strHeight) })).tax_cap
}

export async function getTreasuryParams(strHeight?: string): Promise<LcdTreasuryParams> {
  return (await get('/terra/treasury/v1beta1/params', { height: calculateHeightParam(strHeight) })).params
}

export async function getTaxCaps(strHeight?: string): Promise<LcdTaxCap[]> {
  return (await get('/terra/treasury/v1beta1/tax_caps', { height: calculateHeightParam(strHeight) })).tax_caps || []
}
