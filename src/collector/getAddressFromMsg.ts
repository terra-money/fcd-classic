import { get, uniq } from 'lodash'

export default function getAddressFromMsg(msg): { [key: string]: string[] } {
  if (!msg) {
    return {}
  }

  switch (msg.type) {
    case 'bank/MsgSend': {
      const fromAddress = get(msg, 'value.from_address')
      const toAddress = get(msg, 'value.to_address')
      return {
        send: [fromAddress].filter(Boolean),
        receive: [toAddress].filter(Boolean)
      }
    }

    case 'bank/MsgMultiSend': {
      const inputs = get(msg, 'value.inputs')
      const outputs = get(msg, 'value.outputs')
      const inputAddrs = inputs && inputs.map((input) => input.address)
      const outputAddrs = outputs && outputs.map((output) => output.address)

      return {
        send: uniq(inputAddrs),
        receive: uniq(outputAddrs)
      }
    }

    case 'staking/MsgDelegate':
    case 'staking/MsgCreateValidator':
    case 'staking/MsgBeginRedelegate':
    case 'staking/MsgUndelegate':
    case 'distribution/MsgSetWithdrawAddress':
    case 'distribution/MsgWithdrawValidatorCommission':
    case 'distribution/MsgWithdrawDelegationReward': {
      return {
        staking: [get(msg, 'value.delegator_address')].filter(Boolean)
      }
    }

    case 'market/MsgSwap': {
      return {
        market: [get(msg, 'value.trader')].filter(Boolean)
      }
    }

    case 'oracle/MsgExchangeRateVote':
    case 'oracle/MsgExchangeRatePrevote':
    case 'oracle/MsgAggregateExchangeRateVote':
    case 'oracle/MsgAggregateExchangeRatePrevote': {
      return {
        market: [get(msg, 'value.feeder')].filter(Boolean)
      }
    }

    case 'budget/MsgSubmitProgram':
    case 'budget/MsgWithdrawProgram': {
      return {
        budget: [get(msg, 'value.submitter')].filter(Boolean)
      }
    }

    case 'budget/MsgVoteProgram': {
      return {
        budget: [get(msg, 'value.voter')].filter(Boolean)
      }
    }

    case 'gov/MsgDeposit': {
      return {
        governance: [get(msg, 'value.depositor')].filter(Boolean)
      }
    }

    case 'gov/MsgVote': {
      return {
        governance: [get(msg, 'value.voter')].filter(Boolean)
      }
    }

    case 'gov/MsgSubmitProposal': {
      return {
        governance: [get(msg, 'value.proposer')].filter(Boolean)
      }
    }

    case 'wasm/MsgStoreCode':
      return {
        wasm: [get(msg, 'value.sender')].filter(Boolean)
      }

    case 'wasm/MsgInstantiateContract':
      return {
        wasm: [get(msg, 'value.owner')].filter(Boolean)
      }

    case 'wasm/MsgExecuteContract':
      return {
        wasm: [get(msg, 'value.sender')].filter(Boolean)
      }

    case 'wasm/MsgMigrateContract':
      return {
        wasm: [get(msg, 'value.owner')].filter(Boolean)
      }

    case 'wasm/MsgUpdateContractOwner':
      return {
        wasm: [get(msg, 'value.owner')].filter(Boolean)
      }

    default: {
      return {}
    }
  }
}
