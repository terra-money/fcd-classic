import * as crypto from 'crypto'
import * as rp from 'request-promise'

import config from 'config'

import { plus, getIntegerPortion } from 'lib/math'
import { ErrorTypes, APIError } from './error'

const protocol = require(config.LCD_URI.startsWith('https') ? 'https' : 'http')
const agent = new protocol.Agent({
  rejectUnauthorized: false,
  keepAlive: true
})

const NOT_FOUND_REGEX = /(?:not found|no del|not ex|failed to find|unknown prop|empty bytes|No price reg)/i

async function get(url: string, params?: { [key: string]: string }): Promise<any> {
  const options = {
    method: 'GET',
    rejectUnauthorized: false,
    headers: {
      'Content-Type': 'application/json'
    },
    qs: params,
    json: true,
    agent
  }

  const res = await rp(`${config.LCD_URI}${url}`, options).catch((err) => {
    if (err.statusCode === 404 || (err?.message && NOT_FOUND_REGEX.test(err.message))) {
      return undefined
    }

    if (err.statusCode === 400) {
      throw new APIError(ErrorTypes.INVALID_REQUEST_ERROR)
    }

    throw new APIError(ErrorTypes.LCD_ERROR, err.statusCode, err.message, err)
  })

  if (res?.height && res.result !== undefined) {
    return res.result
  }

  return res
}

///////////////////////////////////////////////
// Transactions
///////////////////////////////////////////////
export function getTx(hash: string): Promise<Transaction.LcdTransaction | undefined> {
  return get(`/txs/${hash}`)
}

function getTxHash(txstring: string): string {
  const s256Buffer = crypto.createHash(`sha256`).update(Buffer.from(txstring, `base64`)).digest()
  const txbytes = new Uint8Array(s256Buffer)
  return Buffer.from(txbytes.slice(0, 32)).toString(`hex`)
}

export function getTxHashesFromBlock(lcdBlock: LcdBlock): string[] {
  const txStrings = lcdBlock.block.data.txs

  if (!txStrings || !txStrings.length) {
    return []
  }

  const hashes = txStrings.map(getTxHash)
  return hashes
}

export function broadcast(body: { tx: Transaction.Value; mode: string }): Promise<Transaction.LcdPostTransaction> {
  const options: rp.RequestPromiseOptions = {
    method: 'POST',
    rejectUnauthorized: false,
    body,
    json: true
  }

  return rp(`${config.LCD_URI}/txs`, options).catch((err) => {
    throw new APIError(ErrorTypes.LCD_ERROR, err.statusCode, err.message, err)
  })
}

///////////////////////////////////////////////
// Tendermint RPC
///////////////////////////////////////////////
export function getLatestValidatorSet(): Promise<LcdLatestValidatorSet> {
  return get(`/validatorsets/latest`)
}

export interface LcdVotingPower {
  totalVotingPower: string
  votingPowerByPubKey: {
    [pubKey: string]: string
  }
}

type VotingPowerByPubKey = { [pubKey: string]: string }

export async function getVotingPower(): Promise<LcdVotingPower> {
  const latestValidatorSet = await getLatestValidatorSet()
  let totalVotingPower = '0'

  const reducer = (acc: VotingPowerByPubKey, { pub_key, voting_power }: LcdLatestValidator): VotingPowerByPubKey => {
    totalVotingPower = plus(totalVotingPower, voting_power)
    return { ...acc, [pub_key]: voting_power }
  }

  const votingPowerByPubKey = Array.isArray(latestValidatorSet.validators)
    ? latestValidatorSet.validators.reduce(reducer, {})
    : {}

  return { totalVotingPower, votingPowerByPubKey }
}

export async function getValidatorVotingPower(consensusPubkey: string): Promise<LcdLatestValidator | undefined> {
  const latestValidatorSet = await getLatestValidatorSet()
  const { validators } = latestValidatorSet
  return validators.find((v) => v.pub_key === consensusPubkey)
}

export function getBlock(height: string): Promise<LcdBlock> {
  return get(`/blocks/${height}`)
}

export function getLatestBlock(): Promise<LcdBlock> {
  return get(`/blocks/latest`)
}

///////////////////////////////////////////////
// Auth
///////////////////////////////////////////////
export async function getAccount(
  address: string
): Promise<StandardAccount | VestingAccount | LazyVestingAccount | ModuleAccount> {
  return (
    (await get(`/auth/accounts/${address}`)) || {
      type: 'auth/Account',
      value: {
        address: '',
        coins: null,
        public_key: null,
        account_number: '0',
        sequence: '0'
      }
    }
  )
}

///////////////////////////////////////////////
// Staking
///////////////////////////////////////////////
export async function getDelegations(delegator: string): Promise<LcdDelegation[]> {
  return (await get(`/staking/delegators/${delegator}/delegations`)) || []
}

export function getDelegationForValidator(delegator: string, validator: string): Promise<LcdDelegation | undefined> {
  return get(`/staking/delegators/${delegator}/delegations/${validator}`)
}

export async function getUnbondingDelegations(address: string): Promise<LcdUnbonding[]> {
  return (await get(`/staking/delegators/${address}/unbonding_delegations`)) || []
}

export async function getValidators(status?: 'bonded' | 'unbonded' | 'unbonding'): Promise<LcdValidator[]> {
  if (status) {
    return get(`/staking/validators?status=${status}`)
  }

  const urlBonded = `/staking/validators?status=bonded`
  const urlUnbonded = `/staking/validators?status=unbonded`
  const urlUnbonding = `/staking/validators?status=unbonding`

  const [bonded, unbonded, unbonding] = await Promise.all([get(urlBonded), get(urlUnbonded), get(urlUnbonding)])

  return [bonded, unbonded, unbonding].flat()
}

export async function getValidator(operatorAddr: string): Promise<LcdValidator | undefined> {
  return get(`/staking/validators/${operatorAddr}`)
}

export async function getValidatorDelegations(validatorOperKey: string): Promise<LcdValidatorDelegationItem[]> {
  return (await get(`/staking/validators/${validatorOperKey}/delegations`)) || []
}

export function getStakingPool(): Promise<LcdStakingPool> {
  return get(`/staking/pool`)
}

///////////////////////////////////////////////
// Governance
///////////////////////////////////////////////
export async function getProposals(): Promise<LcdProposal[]> {
  return (await get(`/gov/proposals`)) || []
}

export function getProposal(proposalId: string): Promise<LcdProposal | undefined> {
  return get(`/gov/proposals/${proposalId}`)
}

export function getProposalProposer(proposalId: string): Promise<LcdProposalProposer | undefined> {
  return get(`/gov/proposals/${proposalId}/proposer`)
}

export function getProposalDepositTxs(proposalId: string): Promise<Transaction.LcdTransactions> {
  const params = {
    'proposal_deposit.proposal_id': proposalId,
    limit: '1000'
  }

  return get(`/txs`, params)
}

export function getProposalVoteTxs(proposalId: string, option?: string): Promise<Transaction.LcdTransactions> {
  const params = {
    'proposal_vote.proposal_id': proposalId,
    limit: '1000'
  }

  if (option) {
    params['proposal_vote.option'] = option
  }

  return get(`/txs`, params)
}

export async function getProposalDeposits(proposalId: string): Promise<LcdProposalDeposit[]> {
  return (await get(`/gov/proposals/${proposalId}/deposits`)) || []
}

export async function getProposalVotes(proposalId: string): Promise<LcdProposalVote[]> {
  return (await get(`/gov/proposals/${proposalId}/votes?limit=1000`)) || []
}

export function getProposalTally(proposalId: string): Promise<LcdProposalTally | undefined> {
  return get(`/gov/proposals/${proposalId}/tally`)
}

export function getProposalDepositParams(): Promise<LcdProposalDepositParams> {
  return get(`/gov/parameters/deposit`)
}

export function getProposalVotingParams(): Promise<LcdProposalVotingParams> {
  return get(`/gov/parameters/voting`)
}

export function getProposalTallyingParams(): Promise<LcdProposalTallyingParams> {
  return get(`/gov/parameters/tallying`)
}

///////////////////////////////////////////////
// Slashing
///////////////////////////////////////////////
export function getSigningInfo(validatorPubKey: string): Promise<LcdValidatorSigningInfo> {
  return get(`/slashing/validators/${validatorPubKey}/signing_info`)
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

export async function getAllRewards(delegatorAddress: string): Promise<Coin[]> {
  const rewards = await get(`/distribution/delegators/${delegatorAddress}/rewards`)
  return rewards?.total && rewards.total.map(rewardMapper).filter(rewardFilter)
}

export async function getRewards(delegatorAddress: string, validatorOperAddress: string): Promise<Coin[]> {
  const rewards = (await get(`/distribution/delegators/${delegatorAddress}/rewards/${validatorOperAddress}`)) || []
  return rewards.map(rewardMapper).filter(rewardFilter)
}

export function getCommissions(validatorAddress: string): Promise<LcdRewardPool | undefined> {
  return get(`/distribution/validators/${validatorAddress}`)
}

export async function getValidatorRewards(validatorOperAddress: string): Promise<LcdRewardPoolItem[]> {
  return (await get(`/distribution/validators/${validatorOperAddress}/outstanding_rewards`)) || []
}

export function getCommunityPool(): Promise<Coin[]> {
  return get(`/distribution/community_pool `)
}

///////////////////////////////////////////////
// Market
///////////////////////////////////////////////
export async function getSwapResult(params: { offer_coin: string; ask_denom: string }): Promise<Coin | undefined> {
  return get(`/market/swap`, params)
}

///////////////////////////////////////////////
// Oracle
///////////////////////////////////////////////
export async function getOraclePrice(denom: string): Promise<{ denom: string; price: string } | null> {
  const priceResponse = await get(`/oracle/denoms/${denom}/exchange_rate`)

  if (!priceResponse) {
    return null
  }

  return {
    denom,
    price: priceResponse
  }
}

export async function getOracleActives(): Promise<string[]> {
  const res = await get(`/oracle/denoms/actives`)

  // from columbus-3
  if (Array.isArray(res)) {
    return res
  }

  // columbus-2 compatibility
  return res.actives || []
}

export async function getActiveOraclePrices(): Promise<CoinByDenoms> {
  const activeDenomsResponse = await getOracleActives()

  if (!activeDenomsResponse) {
    return {}
  }

  const denomsPrices = await Promise.all(activeDenomsResponse.map((denom) => getOraclePrice(denom)))

  return denomsPrices.filter(Boolean).reduce((prev, item) => {
    if (item) {
      prev[item.denom] = item.price
    }

    return prev
  }, {})
}

// non existent addresses will always return "0"
export function getMissedOracleVotes(operatorAddr: string): Promise<string> {
  return get(`/oracle/voters/${operatorAddr}/miss`)
}

///////////////////////////////////////////////
// Treasury
///////////////////////////////////////////////
// async function getLunaSupply() {
//   // columbus-2
//   const response = await getStakingPool()
//   const { not_bonded_tokens: notBondedTokens, bonded_tokens: bondedTokens } = response
//   return plus(notBondedTokens, bondedTokens)
// }

export async function getDenomIssuanceAfterGenesis(denom: string, day: number): Promise<object | null> {
  // columbus-2
  const res = await get(`/treasury/issuance/${denom}/${day}`)

  if (!res.issuance) {
    return null
  }

  return {
    denom,
    issuance: res.issuance
  }
}

export async function getTotalSupply(): Promise<Coin[]> {
  return (await get(`/supply/total`)) || []
}

export async function getIssuanceByDenom(denom: string): Promise<{ denom: string; issuance: string }> {
  // columbus-2, const issuance = denom === 'uluna' ? await getLunaSupply() : await get(`/supply/total/${denom}`);
  const totalSupply = await getTotalSupply()
  const supply = totalSupply.find((s) => s.denom === denom) || { amount: '0' }
  return { denom, issuance: supply.amount }
}

export async function getAllActiveIssuance(): Promise<{ [denom: string]: string }> {
  return (await getTotalSupply()).reduce((acc, item) => {
    acc[item.denom] = item.amount
    return acc
  }, {})
}

export function getTaxProceeds(): Promise<Coin[]> {
  return get(`/treasury/tax_proceeds`)
}

export function getSeigniorageProceeds(): Promise<string> {
  return get(`/treasury/seigniorage_proceeds`)
}

export async function getTaxRate(height?: string): Promise<string> {
  const taxRate = await get(`/treasury/tax_rate`, height ? { height } : undefined)
  return taxRate ? taxRate : get(`/treasury/tax_rate`) // fallback for col-3 to col-4 upgrade
}

export async function getTaxCap(denom: string, height?: string): Promise<string> {
  const taxCaps = await get(`/treasury/tax_cap/${denom}`, height ? { height } : undefined)
  return taxCaps ? taxCaps : get(`/treasury/tax_cap/${denom}`) // fallback for col-3 to col-4 upgrade
}

export async function getContractStore(contractAddress: string, query: any): Promise<Record<string, unknown>> {
  return get(`/wasm/contracts/${contractAddress}/store?query_msg=${JSON.stringify(query)}`)
}
