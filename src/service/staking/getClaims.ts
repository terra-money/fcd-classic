import { get, compact } from 'lodash'
import { getRepository, Brackets, WhereExpressionBuilder } from 'typeorm'
import { TxEntity } from 'orm'
import { convertAddress, sortDenoms, splitDenomAndAmount } from 'lib/common'

function parseTxEntity(tx: TxEntity) {
  const msgs = tx.data.tx.value.msg

  return msgs.map((msg, i: number) => {
    const msgType = msg.type
    const events = tx.data.logs[i].events

    if (!events) {
      return null
    }

    let type: string
    let amounts: Coin[]

    switch (msgType) {
      case 'distribution/MsgWithdrawValidatorCommission': {
        type = 'Commission'
        const withdrawEvent = events.find((e) => e.type === 'withdraw_commission')

        if (!withdrawEvent) {
          return null
        }

        amounts = get(withdrawEvent, 'attributes.0.value', '').split(',').map(splitDenomAndAmount)
        break
      }
      case 'distribution/MsgWithdrawDelegationReward': {
        type = 'Reward'
        const withdrawEvent = events.find((e) => e.type === 'withdraw_rewards')

        if (!withdrawEvent) {
          return null
        }

        amounts = get(withdrawEvent, 'attributes.0.value', '').split(',').map(splitDenomAndAmount)
        break
      }
      default:
        return null
    }

    return {
      chainId: tx.chainId,
      txhash: tx.data['txhash'],
      type,
      amounts: sortDenoms(amounts),
      timestamp: tx.data['timestamp']
    }
  })
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
  return compact(txs.map(parseTxEntity).flat())
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
