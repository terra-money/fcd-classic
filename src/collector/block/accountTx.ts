import { getRepository, MoreThan } from 'typeorm'
import { mergeWith, union } from 'lodash'
import { TxEntity, AccountTxEntity } from 'orm'
import { get, uniq } from 'lodash'

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

export default function getAddressFromMsg(
  msg: Transaction.Message,
  log?: Transaction.Log
): { [key: string]: string[] } {
  if (!msg) {
    return {}
  }

  let result: {
    [action: string]: string[]
  }

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
    case 'distribution/MsgSetWithdrawAddress':
    case 'distribution/MsgWithdrawDelegationReward':
      result = {
        staking: [value.delegator_address]
      }
      break

    case 'distribution/MsgWithdrawValidatorCommission':
      result = {
        staking: [value.validator_address]
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

    case 'budget/MsgSubmitProgram':
    case 'budget/MsgWithdrawProgram':
      result = {
        budget: [value.submitter]
      }
      break

    case 'budget/MsgVoteProgram':
      result = {
        budget: [value.voter]
      }
      break

    case 'gov/MsgDeposit':
      result = {
        governance: [value.depositor]
      }
      break

    case 'gov/MsgVote':
      result = {
        governance: [value.voter]
      }
      break

    case 'gov/MsgSubmitProposal':
      result = {
        governance: [value.proposer]
      }
      break

    case 'wasm/MsgStoreCode':
      result = {
        contract: [value.sender]
      }
      break

    case 'wasm/MsgInstantiateContract': {
      const contract = get(log, 'events[0].attributes[2].value')
      result = {
        contract: [value.owner, contract]
      }
      break
    }

    case 'wasm/MsgExecuteContract':
      result = {
        contract: [value.sender, value.contract]
      }
      break

    case 'wasm/MsgMigrateContract':
      result = {
        contract: [value.owner, value.contract]
      }
      break

    case 'wasm/MsgUpdateContractOwner':
      result = {
        contract: [value.owner, value.new_owner, value.contract]
      }
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

    default:
      result = {}
      break
  }

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
  const concatArray = (objValue, srcValue) => union(objValue, srcValue)
  const addrObj = msgs
    .map((msg, index) => getAddressFromMsg(msg, logs ? logs[index] : undefined))
    .reduce((acc, item) => mergeWith(acc, item, concatArray), {})

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
