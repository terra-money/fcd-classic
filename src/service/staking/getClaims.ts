import { get } from 'lodash'
import { getRepository, Brackets, WhereExpressionBuilder } from 'typeorm'
import { TxEntity } from 'orm'
import { convertAddress, sortDenoms, splitDenomAndAmount } from 'lib/common'

function getClaimFromCol2(tx) {
  const tags = get(tx, 'data.tags')

  if (!tags) {
    return []
  }

  const msgs = get(tx, 'data.tx.value.msg')
  let tagIndex = 0

  return (
    msgs &&
    msgs.map((msg) => {
      const msgType = get(msg, 'type')

      let type: string
      let amounts: Coin[]

      if (msgType === 'cosmos-sdk/MsgWithdrawValidatorCommission') {
        // columbus-1
        type = 'Commission'
        amounts = []
      } else if (msgType === 'cosmos-sdk/MsgWithdrawDelegationReward') {
        // columbus-1
        type = 'Reward'
        amounts = []
      } else if (msgType === 'distribution/MsgWithdrawValidatorCommission') {
        // columbus-2
        type = 'Commission'
        amounts = get(tags, `[${tagIndex + 1}].value`, '')
          .split(',')
          .map(splitDenomAndAmount)
        tagIndex += 3
      } else if (msgType === 'distribution/MsgWithdrawDelegationReward') {
        // columbus-2
        type = 'Reward'
        amounts = get(tags, `[${tagIndex + 1}].value`, '')
          .split(',')
          .map(splitDenomAndAmount)
        tagIndex += 4
      } else {
        return null
      }

      return {
        chainId: tx.chainId,
        tx: tx.data['txhash'],
        type,
        amounts: sortDenoms(amounts),
        timestamp: tx.data['timestamp']
      }
    })
  )
}

function parseTxEntity(tx: TxEntity) {
  if (get(tx, 'data.tags')) {
    return getClaimFromCol2(tx)
  }

  const msgs = get(tx, 'data.tx.value.msg')

  return (
    msgs &&
    msgs.map((msg, i: number) => {
      const msgType = get(msg, 'type')
      const events = get(tx, `data.logs.${i}.events`)

      let type: string
      let amounts: Coin[]

      if (msgType === 'distribution/MsgWithdrawValidatorCommission') {
        type = 'Commission'

        const withdrawEvent = events.find((e) => e.type === 'withdraw_commission')

        if (!withdrawEvent) {
          return null
        }

        amounts = get(withdrawEvent, 'attributes.0.value', '').split(',').map(splitDenomAndAmount)
      } else if (msgType === 'distribution/MsgWithdrawDelegationReward') {
        type = 'Reward'
        const withdrawEvent = events.find((e) => e.type === 'withdraw_rewards')

        if (!withdrawEvent) {
          return null
        }

        amounts = get(withdrawEvent, 'attributes.0.value', '').split(',').map(splitDenomAndAmount)
      } else {
        return null
      }

      return {
        chainId: tx.chainId,
        txhash: tx.data['txhash'],
        tx: tx.data['txhash'], // TODO: remove
        type,
        amounts: sortDenoms(amounts),
        timestamp: tx.data['timestamp']
      }
    })
  )
}

interface DelegationClaim {
  chainId: string
  txhash: string
  tx: string // tx hash of claim, TODO: remove
  type: string // tx types like reward, commission
  amounts: Coin[] // amounts in with their denoms
  timestamp: string // tx timestamp
}

function getMsgsFromTxs(txs: TxEntity[]): DelegationClaim[] {
  return txs.map(parseTxEntity).flat().filter(Boolean)
}

interface GetClaimsParam {
  operatorAddr: string
  limit: number
  offset?: number
}

interface ClaimTxReturn {
  next?: number
  limit: number
  claims: DelegationClaim[]
}

interface ClaimTxList {
  next?: number
  txs: TxEntity[] // claims tx list
}

function addClaimFilterToQuery(qb: WhereExpressionBuilder, operatorAddress: string, accountAddress: string) {
  qb.andWhere(
    new Brackets((q) => {
      q.andWhere(
        new Brackets((qinner) => {
          qinner
            .where(`data->'code' IS NULL`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "distribution/MsgWithdrawValidatorCommission"}]'`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
        })
      ).orWhere(
        new Brackets((qinner) => {
          qinner
            .where(`data->'code' IS NULL`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "type": "distribution/MsgWithdrawDelegationReward"}]'`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "validator_address": "${operatorAddress}" } }]'`)
            .andWhere(`data->'tx'->'value'->'msg'@>'[{ "value": { "delegator_address": "${accountAddress}" } }]'`)
        })
      )
    })
  )
}

async function getClaimTxs({ operatorAddr, limit, offset }: GetClaimsParam): Promise<ClaimTxList> {
  const qb = getRepository(TxEntity).createQueryBuilder('tx').select(['tx.id', 'tx.chainId', 'tx.data'])

  if (offset) {
    qb.where(`id < :offset`, { offset })
  }

  const accountAddr = convertAddress('terra', operatorAddr)
  addClaimFilterToQuery(qb, operatorAddr, accountAddr)

  qb.take(limit + 1).orderBy('timestamp', 'DESC')

  const txs = await qb.getMany()
  let next

  // we have next result
  if (limit + 1 === txs.length) {
    next = txs[limit - 1].id
    txs.length -= 1
  }

  return { next, txs }
}

export async function getClaims(param: GetClaimsParam): Promise<ClaimTxReturn> {
  const { next, txs } = await getClaimTxs(param)

  return {
    next,
    limit: param.limit,
    claims: getMsgsFromTxs(txs)
  }
}
