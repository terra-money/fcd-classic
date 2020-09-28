import format from 'lib/format'
import getMoniker from 'lib/getMoniker'
import { splitDenomAndAmount } from 'lib/common'
import { get } from 'lodash'
import { getSwapCoinAndFee } from './helper'

type Params = Transaction.Message & { address?: string; log?: Transaction.Log }
type Parsed = { tag: string; text: string; tax?: string }
type Parser = ({ type, value, address }: Params) => Promise<Parsed> | Parsed

const bank: Parser = ({ type, value: v, address, log }) => {
  const messages: { [type: string]: () => Parsed } = {
    MsgSend: () => {
      const isSent = v.from_address === address
      // const isSelf = v.from_address === v.to_address
      const [{ amount, denom }]: Coin[] = v.amount
      let tax: string | undefined

      if (typeof log?.log === 'object') {
        tax = log.log.tax
      }

      return {
        tag: isSent ? 'Send' : 'Receive',
        text: `${isSent ? 'Sent' : 'Received'} ${format.amount(amount)} ${format.denom(denom)} \
${isSent ? 'to' : 'from'} ${isSent ? v.to_address : v.from_address}`,
        [`${isSent ? 'out' : 'in'}`]: v.amount,
        tax
      }
    },
    MsgMultiSend: () => {
      const input = get(v, 'inputs')
      return {
        tag: 'Multisend',
        text: `Sent multiSend message with ${input.length} inputs`
      }
    }
  }

  return messages[type]()
}

const distribute: Parser = ({ type, value: v }) => {
  const messages: { [type: string]: () => Promise<Parsed> | Parsed } = {
    MsgSetWithdrawAddress: () => ({
      tag: 'Staking',
      text: `Set withdraw address as ${v.withdraw_address}`
    }),
    MsgWithdrawDelegationReward: async () => {
      const moniker = await getMoniker(v.validator_address)
      return {
        tag: 'Staking',
        text: `Withdrew reward from ${moniker}`
      }
    },
    MsgWithdrawValidatorCommission: async () => {
      const moniker = await getMoniker(v.validator_address)
      return {
        tag: 'Staking',
        text: `Withdrew ${moniker}'s commission`
      }
    }
  }

  return messages[type]()
}

const slashing: Parser = ({ type, value: v }) => {
  const messages: { [type: string]: () => Parsed } = {
    MsgUnjail: () => ({
      tag: 'Slashing',
      text: `Unjail requested for ${v.address}`
    })
  }

  return messages[type]()
}

const staking: Parser = async ({ type, value: v }) => {
  const messages: { [type: string]: () => Promise<Parsed> | Parsed } = {
    MsgCreateValidator: () => ({
      tag: 'Staking',
      text: `Created validator ${v.validator_address}`
    }),
    MsgEditValidator: () => ({
      tag: 'Staking',
      text: `Edited validator ${v.validator_address}`
    }),
    MsgDelegate: async () => {
      const moniker = await getMoniker(v.validator_address)
      return {
        tag: 'Staking',
        text: `Delegated ${format.coin(v.amount)} to ${moniker}`
      }
    },
    MsgBeginRedelegate: async () => {
      const srcMoniker = await getMoniker(v.validator_src_address)
      const dstMoniker = await getMoniker(v.validator_dst_address)
      return {
        tag: 'Staking',
        text: `Redelegated ${format.coin(v.amount)} from ${srcMoniker} to ${dstMoniker}`
      }
    },
    MsgUndelegate: async () => {
      const moniker = await getMoniker(v.validator_address)
      return {
        tag: 'Staking',
        text: `Requested to undelegate ${format.coin(v.amount)} from ${moniker}`
      }
    }
  }

  return messages[type]()
}

const custom: Parser = ({ type, value: v, log }: Params) => {
  const messages: { [type: string]: () => Parsed } = {
    MsgPricePrevote: () => ({
      tag: 'Market',
      text: `Prevoted price of LUNA denominated in ${format.denom(v.denom)}`
    }),
    MsgPriceVote: () => ({
      tag: 'Market',
      text: `Voted orice of LUNA denominated in ${format.denom(v.denom)}`
    }),
    MsgSwap: () => {
      if (!log) {
        return {
          tag: 'Swap',
          text: `Swapped ${format.coin(v.offer_coin)}`,
          out: [],
          in: []
        }
      }

      const { swapCoin, swapFee } = getSwapCoinAndFee(log)
      let swapCoinMsg = ''

      if (swapCoin) {
        const { amount, denom } = splitDenomAndAmount(swapCoin)
        swapCoinMsg = `for ${format.amount(amount)} ${format.denom(denom)}`
      }

      return {
        tag: 'Market',
        text: `Swapped ${format.coin(v.offer_coin)} ${swapCoinMsg}`,
        out: [v.offer_coin],
        in: [splitDenomAndAmount(swapCoin)],
        tax: swapFee
      }
    },
    MsgSubmitProgram: () => ({
      tag: 'Budget',
      text: `Submit budget program '${v.title}'`
    }),
    MsgWithdrawProgram: () => ({
      tag: 'Budget',
      text: `Withdraw program ${v.program_id}`
    }),
    MsgVoteProgram: () => ({
      tag: 'Budget',
      text: `Vote ${v.option ? 'YES' : 'NO'} for program ${v.program_id}`
    })
  }

  return messages[type]()
}

const gov: Parser = ({ type, value: v }) => {
  const messages: { [type: string]: () => Parsed } = {
    MsgDeposit: () => {
      const [{ amount, denom }]: Coin[] = v.amount
      return {
        tag: 'Governance',
        text: `Deposited ${format.amount(amount)} ${format.denom(denom)} to Proposal ${v.proposal_id}`
      }
    },
    MsgVote: () => {
      return {
        tag: 'Governance',
        text: `Voted ${v.option} for proposal ${v.proposal_id}`
      }
    },
    MsgSubmitProposal: () => {
      const title = get(v, 'content.value.title')
      let initialDepositStr = ''
      if (v.initial_deposit && v.initial_deposit.length > 0) {
        const [{ amount, denom }]: Coin[] = v.initial_deposit
        initialDepositStr = ` with ${format.amount(amount)} ${format.denom(denom)} deposit`
      }
      return {
        tag: 'Governance',
        text: `Created proposal '${title}'${initialDepositStr}`
      }
    }
  }

  return messages[type]()
}

const defaultParser: Parser = ({ type, value: v }) => ({
  tag: 'Default',
  text: type,
  details: Object.entries(v)
})

const types: { [type: string]: Parser } = {
  MsgSend: bank,
  MsgMultiSend: bank,
  MsgSetWithdrawAddress: distribute,
  MsgWithdrawDelegationReward: distribute,
  MsgWithdrawValidatorCommission: distribute,
  MsgUnjail: slashing,
  MsgCreateValidator: staking,
  MsgEditValidator: staking,
  MsgDelegate: staking,
  MsgBeginRedelegate: staking,
  MsgUndelegate: staking,
  MsgPricePrevote: custom,
  MsgPriceVote: custom,
  MsgSwap: custom,
  MsgSubmitProgram: custom,
  MsgWithdrawProgram: custom,
  MsgVoteProgram: custom,
  MsgVote: gov,
  MsgDeposit: gov,
  MsgSubmitProposal: gov
}

export default async (
  message: Transaction.Message,
  log: Transaction.Log,
  address: string | undefined,
  success: boolean
): Promise<ParsedTxMsgInfo> => {
  const type = message.type.split('/')[1]
  const parser = types[type] || defaultParser
  const parsed: ParsedTxMsgInfo = await parser({ ...message, type, address, log })

  if (!success) {
    parsed.text = `Fail to ${parsed.text}`
  }

  return parsed
}
