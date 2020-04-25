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
        send: fromAddress ? [fromAddress] : [],
        receive: toAddress ? [toAddress] : []
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
        staking: get(msg, 'value.delegator_address') ? [get(msg, 'value.delegator_address')] : []
      }
    }

    case 'market/MsgSwap': {
      return {
        market: get(msg, 'value.trader') ? [get(msg, 'value.trader')] : []
      }
    }

    case 'oracle/MsgExchangeRateVote':
    case 'oracle/MsgExchangeRatePrevote': {
      return {
        market: get(msg, 'value.feeder') ? [get(msg, 'value.feeder')] : []
      }
    }

    case 'budget/MsgSubmitProgram':
    case 'budget/MsgWithdrawProgram': {
      return {
        budget: get(msg, 'value.submitter') ? [get(msg, 'value.submitter')] : []
      }
    }

    case 'budget/MsgVoteProgram': {
      return {
        budget: get(msg, 'value.voter') ? [get(msg, 'value.voter')] : []
      }
    }

    case 'gov/MsgDeposit': {
      return {
        governance: get(msg, 'value.depositor') ? [get(msg, 'value.depositor')] : []
      }
    }

    case 'gov/MsgVote': {
      return {
        governance: get(msg, 'value.voter') ? [get(msg, 'value.voter')] : []
      }
    }

    case 'gov/MsgSubmitProposal': {
      return {
        governance: get(msg, 'value.proposer') ? [get(msg, 'value.proposer')] : []
      }
    }

    default: {
      return {}
    }
  }
}
