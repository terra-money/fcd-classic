import { getRepository, MoreThan } from 'typeorm'
import { mergeWith, union } from 'lodash'
import { TxEntity, AccountTxEntity } from 'orm'
import { uniq } from 'lodash'
import { TERRA_ACCOUNT_REGEX } from 'lib/constant'
import { findAssetByPair, findAssetByToken } from 'service/treasury/token'

async function getRecentlySyncedTx(): Promise<number> {
  const latestSynced = await getRepository(AccountTxEntity).find({
    order: {
      id: 'DESC'
    },
    take: 1
  })

  if (!latestSynced || latestSynced.length === 0) {
    return 0
  }

  const latestSyncedTx = await getRepository(TxEntity).findOne({
    hash: latestSynced[0].hash
  })

  return latestSyncedTx ? latestSyncedTx.id : 0
}

export async function getTargetTx(tx?: TxEntity): Promise<TxEntity | undefined> {
  const recentlySyncedTxNumber = tx ? tx.id : await getRecentlySyncedTx()
  const targetTxs = await getRepository(TxEntity).find({
    where: {
      id: MoreThan(recentlySyncedTxNumber)
    },
    order: {
      id: 'ASC'
    },
    take: 1
  })

  return targetTxs[0]
}

export function extractAddressFromContractMsg(value: { [key: string]: any }): { [action: string]: string[] } {
  try {
    const executeMsg = JSON.parse(Buffer.from(value.execute_msg, 'base64').toString())
    const send: string[] = []
    const receive: string[] = []
    const market: string[] = []

    if (findAssetByToken(value.contract)) {
      // Sell to TerraSwap
      if (executeMsg.send) {
        // `to` can be assigned when selling tokens
        if (executeMsg.send.to) {
          send.push(value.sender)
          receive.push(executeMsg.send.to)
        } else {
          market.push(value.sender)
        }
      } else if (executeMsg.transfer && executeMsg.transfer.recipient) {
        // Send token to another address
        send.push(value.sender)
        receive.push(executeMsg.transfer.recipient)
      }
    } else if (findAssetByPair(value.contract)) {
      // Buy from TerraSwap
      if (executeMsg.swap) {
        // `to` can be assigned when buying (swap ust to cw20) tokens
        if (executeMsg.swap.to) {
          send.push(value.sender)
          receive.push(executeMsg.swap.to)
        } else {
          market.push(value.sender)
        }
      }
    } else if (Array.isArray(value.coins) && value.coins.length) {
      // Any contract can receive coins
      send.push(value.sender)
    }

    return {
      send,
      receive,
      market
    }
  } catch (e) {
    return {}
  }
}

export default function getAddressFromMsg(
  msg: Transaction.Message,
  log?: Transaction.Log
): { [key: string]: string[] } {
  if (!msg) {
    return {}
  }

  let result: {
    [action: string]: string[]
  } = {}

  const value = msg.value

  switch (msg.type) {
    case 'bank/MsgSend': {
      const fromAddress = value.from_address
      const toAddress = value.to_address

      result = {
        send: [fromAddress],
        receive: [toAddress]
      }
      break
    }

    case 'bank/MsgMultiSend': {
      const inputs = value.inputs || []
      const outputs = value.outputs || []

      result = {
        send: inputs.map((input) => input.address),
        receive: outputs.map((output) => output.address)
      }
      break
    }

    case 'staking/MsgDelegate':
    case 'staking/MsgCreateValidator':
    case 'staking/MsgBeginRedelegate':
    case 'staking/MsgUndelegate':
    case 'distribution/MsgWithdrawDelegationReward':
      result = {
        staking: [value.delegator_address]
      }
      break

    case 'distribution/MsgModifyWithdrawAddress':
    case 'distribution/MsgSetWithdrawAddress':
      result = {
        staking: [value.delegator_address, value.withdraw_address]
      }
      break

    case 'market/MsgSwap':
    case 'market/MsgSwapSend':
      result = {
        receive: [value.recipient],
        market: [value.trader]
      }
      break

    case 'oracle/MsgExchangeRateVote':
    case 'oracle/MsgExchangeRatePrevote':
    case 'oracle/MsgAggregateExchangeRateVote':
    case 'oracle/MsgAggregateExchangeRatePrevote':
      result = {
        market: [value.feeder]
      }
      break

    case 'gov/MsgDeposit':
      result = {
        governance: [value.depositor]
      }
      break

    case 'gov/MsgVote':
    case 'gov/MsgVoteWeighted': // since columbus-5
      result = {
        governance: [value.voter]
      }
      break

    case 'gov/MsgSubmitProposal':
      result = {
        governance: [value.proposer]
      }
      break

    case 'wasm/MsgExecuteContract':
      result = extractAddressFromContractMsg(value)
      break

    case 'msgauth/MsgGrantAuthorization':
      result = {
        msgauth: [value.granter, value.grantee]
      }
      break

    case 'msgauth/MsgRevokeAuthorization':
      result = {
        msgauth: [value.granter, value.grantee]
      }
      break

    case 'msgauth/MsgExecAuthorized':
      result = msg.value.msgs.map(getAddressFromMsg).reduce(
        (acc, cur) => {
          Object.keys(cur).forEach((key) => {
            if (!acc[key]) {
              acc[key] = []
            }

            acc[key] = acc[key].concat(cur[key])
          })
          return acc
        },
        {
          msgauth: [value.grantee]
        }
      )
      break
  }

  const wasmEventAttributeTypes = [
    'store_code',
    'instantiate_contract',
    'execute_contract',
    'migrate_contract',
    'update_contract_admin',
    'clear_contract_admin',
    'update_contract_owner'
  ]

  result.contract = (log?.events ?? [])
    .map(
      (ev) =>
        wasmEventAttributeTypes.includes(ev.type) &&
        ev.attributes.filter((attr) => TERRA_ACCOUNT_REGEX.test(attr.value)).map((attr) => attr.value)
    )
    .flat()
    .filter(Boolean) as string[]

  Object.keys(result).forEach((action) => {
    result[action] = uniq(result[action].filter(Boolean))
  })

  return result
}

/**
 * This function parses TxEntity for generating AccountTxEntity[]
 * @param tx TxEntity
 */
export function generateAccountTxs(tx: TxEntity): AccountTxEntity[] {
  const msgs = tx.data.tx.value.msg
  const logs = tx.data.logs
  const addrObj = msgs
    .map((msg, index) => getAddressFromMsg(msg, logs ? logs[index] : undefined))
    .reduce((acc, item) => mergeWith(acc, item, union), {})

  return Object.keys(addrObj)
    .map((type) => {
      return addrObj[type].map((addr) => {
        const accountTx = new AccountTxEntity()
        accountTx.account = addr
        accountTx.hash = tx.hash
        accountTx.tx = tx
        accountTx.type = type
        accountTx.timestamp = new Date(tx.data['timestamp'])
        accountTx.chainId = tx.chainId
        return accountTx
      })
    })
    .flat()
}
