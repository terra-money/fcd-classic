import format from 'lib/format'
import getMoniker from 'lib/getMoniker'
import { splitDenomAndAmount } from 'lib/common'
import { get } from 'lodash'
import { convertToFailureMessage, getSwapCoinAndFee } from './helper'

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

const slashing: Parser = ({ type, value: v }) => {
  const tag = 'Slashing'

  const messages: { [type: string]: () => Parsed } = {
    MsgUnjail: () => ({
      tag,
      text: `Requested unjail for ${v.address}`
    })
  }

  return messages[type]()
}

const staking: Parser = async ({ type, value: v }) => {
  const tag = 'Staking'
  const messages: { [type: string]: () => Promise<Parsed> | Parsed } = {
    MsgSetWithdrawAddress: () => ({
      tag,
      text: `Set withdraw address as ${v.withdraw_address}`
    }),
    MsgWithdrawDelegationReward: async () => {
      const moniker = await getMoniker(v.validator_address)
      return {
        tag,
        text: `Withdrew reward from ${moniker}`
      }
    },
    MsgWithdrawValidatorCommission: async () => {
      const moniker = await getMoniker(v.validator_address)
      return {
        tag,
        text: `Withdrew ${moniker}'s commission`
      }
    },
    MsgCreateValidator: () => ({
      tag,
      text: `Created validator ${v.validator_address}`
    }),
    MsgEditValidator: () => ({
      tag,
      text: `Edited validator ${v.validator_address}`
    }),
    MsgDelegate: async () => {
      const moniker = await getMoniker(v.validator_address)
      return {
        tag,
        text: `Delegated ${format.coin(v.amount)} to ${moniker}`
      }
    },
    MsgBeginRedelegate: async () => {
      const srcMoniker = await getMoniker(v.validator_src_address)
      const dstMoniker = await getMoniker(v.validator_dst_address)
      return {
        tag,
        text: `Redelegated ${format.coin(v.amount)} from ${srcMoniker} to ${dstMoniker}`
      }
    },
    MsgUndelegate: async () => {
      const moniker = await getMoniker(v.validator_address)
      return {
        tag,
        text: `Requested to undelegate ${format.coin(v.amount)} from ${moniker}`
      }
    }
  }

  return messages[type]()
}

const oracle: Parser = ({ type, value: v, log }: Params) => {
  const tag = 'Swap'
  const messages: { [type: string]: () => Parsed } = {
    MsgPricePrevote: () => ({
      tag,
      text: `Prevoted price of LUNA denominated in ${format.denom(v.denom)}`
    }),
    MsgPriceVote: () => ({
      tag,
      text: `Voted orice of LUNA denominated in ${format.denom(v.denom)}`
    }),
    MsgSwap: () => {
      if (!log) {
        return {
          tag,
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
        tag,
        text: `Swapped ${format.coin(v.offer_coin)} ${swapCoinMsg}`,
        out: [v.offer_coin],
        in: [splitDenomAndAmount(swapCoin)],
        tax: swapFee
      }
    }
  }

  return messages[type]()
}

const gov: Parser = ({ type, value: v }) => {
  const tag = 'Governance'

  const messages: { [type: string]: () => Parsed } = {
    MsgDeposit: () => {
      const [{ amount, denom }]: Coin[] = v.amount
      return {
        tag,
        text: `Deposited ${format.amount(amount)} ${format.denom(denom)} to Proposal ${v.proposal_id}`
      }
    },
    MsgVote: () => {
      return {
        tag,
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
        tag,
        text: `Created proposal '${title}'${initialDepositStr}`
      }
    }
  }

  return messages[type]()
}

const contract: Parser = ({ type, value: v, log }) => {
  const tag = 'Contract'

  const messages: { [type: string]: () => Parsed } = {
    MsgStoreCode: () => {
      const codeId = get(log, 'events[1].attributes[1].value')

      return {
        tag,
        text: `Stored ${codeId}`
      }
    },
    MsgInstantiateContract: () => {
      const contract = get(log, 'events[0].attributes[2].value')
      // const msg = v.init_msg

      return {
        tag,
        text: `Instantiated ${contract} from code ${v.code_id}`
      }
    },
    MsgExecuteContract: () => {
      const method = Object.keys(v.execute_msg)[0] || '?'
      let text = `Executed ${method} on ${v.contract}`

      if (Array.isArray(v.coins) && v.coins.length) {
        text += ` with ${v.coins.map((coin) => `${format.amount(coin.amount)} ${format.denom(coin.denom)}`).join(', ')}`
      }

      return {
        tag,
        text
      }
    },
    MsgMigrateContract: () => {
      // const msg = v.migrate_msg
      return {
        tag,
        text: `Migrated ${v.contract} to code ${v.new_code_id}`
      }
    },
    MsgUpdateContractOwner: () => {
      return {
        tag,
        text: `Changed ${v.contract} owner to ${v.new_owner} from ${v.owner}`
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
  MsgUnjail: slashing,
  MsgSetWithdrawAddress: staking,
  MsgWithdrawDelegationReward: staking,
  MsgWithdrawValidatorCommission: staking,
  MsgCreateValidator: staking,
  MsgEditValidator: staking,
  MsgDelegate: staking,
  MsgBeginRedelegate: staking,
  MsgUndelegate: staking,
  MsgPricePrevote: oracle,
  MsgPriceVote: oracle,
  MsgSwap: oracle,
  MsgVote: gov,
  MsgDeposit: gov,
  MsgSubmitProposal: gov,
  MsgStoreCode: contract,
  MsgInstantiateContract: contract,
  MsgExecuteContract: contract,
  MsgMigrateContract: contract,
  MsgUpdateContractOwner: contract
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
    parsed.text = `Failed to ${convertToFailureMessage(parsed.text || '')}`
  }

  return parsed
}
