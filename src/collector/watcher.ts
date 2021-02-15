import * as Bluebird from 'bluebird'
import { uniq } from 'lodash'
import * as sentry from '@sentry/node'
import { unmarshalTx } from '@terra-money/amino-js'
import { collectorLogger as logger } from 'lib/logger'
import RPCWatcher, { RpcResponse } from 'lib/RPCWatcher'
import * as lcd from 'lib/lcd'
import config from 'config'
import { saveValidatorDetail } from './staking/validatorDetails'
import { collectBlock } from './block'
import { saveProposalDetails } from './gov'
import { getValidatorsVotingPower } from 'service/governance'

const SOCKET_URL = `${config.RPC_URI}/websocket`
const GOVERNANCE_Q = `tm.event='Tx' AND message.module='governance'`
const NEW_BLOCK_Q = `tm.event='NewBlock'`
const VALIDATOR_REGEX = /terravaloper([a-z0-9]{39})/g

/**
 * For throttling purpose,
 * 1. detectValidators extracts valoper... from stringified tx and add to the validatorUpdateSet
 * 2. collectValidators collects validator for addresses from validatorUpdateSet
 */
const validatorUpdateSet = new Set<string>()

async function detectValidators(data: RpcResponse) {
  const marshalTxs = data.result.data?.value.block?.data.txs as string[]

  if (marshalTxs) {
    try {
      // decode amino transactions
      const txs = marshalTxs.map((tx) => unmarshalTx(Buffer.from(tx, 'base64')))

      // extract validator addresses from string
      const addresses = uniq(
        txs
          .map((tx) => JSON.stringify(tx).match(VALIDATOR_REGEX))
          .flat()
          .filter(Boolean) as string[]
      )

      addresses.forEach((address) => validatorUpdateSet.add(address))
    } catch (err) {
      sentry.captureException(err)
    }
  }
}

async function collectValidators() {
  const addrs = Array.from(validatorUpdateSet.values())
  validatorUpdateSet.clear()

  const votingPower = await lcd.getVotingPower()
  const activePrices = await lcd.getActiveOraclePrices()

  await Bluebird.mapSeries(addrs, (addr) =>
    lcd
      .getValidator(addr)
      .then((lcdValidator) => lcdValidator && saveValidatorDetail({ lcdValidator, activePrices, votingPower }))
  )

  setTimeout(collectValidators, 5000)
}

const proposalUpdateSet = new Set<string>()

async function collectProposals() {
  const proposalIds = Array.from(proposalUpdateSet.values())
  proposalUpdateSet.clear()

  if (proposalIds.length === 0) {
    setTimeout(collectProposals, 1000)
    return
  }

  const proposalTallyingParams = await lcd.getProposalTallyingParams()
  const proposalDepositParams = await lcd.getProposalDepositParams()
  const validatorsVotingPower = await getValidatorsVotingPower()

  await Bluebird.mapSeries(proposalIds, (id) =>
    lcd
      .getProposal(id)
      .then((proposal) =>
        saveProposalDetails(proposal, proposalTallyingParams, proposalDepositParams, validatorsVotingPower)
      )
  )

  setTimeout(collectProposals, 5000)
}

async function detectProposals(resp: RpcResponse) {
  Object.keys(resp.result.events).forEach((key) => {
    if (key.includes('proposal_id')) {
      resp.result.events[key].forEach((value) => {
        if (!Number.isNaN(parseInt(value, 10))) {
          proposalUpdateSet.add(value)
        }
      })
    }
  })
}

let blockUpdated = true

async function collectBlocks() {
  if (!blockUpdated) {
    setTimeout(collectBlocks, 50)
    return
  }

  blockUpdated = false
  await collectBlock().catch(sentry.captureException)
  setTimeout(collectBlocks, 50)
}

export async function startWatcher() {
  let eventCounter = 0
  const watcher = new RPCWatcher({
    url: SOCKET_URL,
    logger
  })

  watcher.registerSubscriber(GOVERNANCE_Q, async (resp: RpcResponse) => {
    eventCounter += 1
    await detectProposals(resp).catch(sentry.captureException)
  })

  watcher.registerSubscriber(NEW_BLOCK_Q, async (resp: RpcResponse) => {
    eventCounter += 1
    blockUpdated = true
    await detectValidators(resp).catch(sentry.captureException)
  })

  await watcher.start()

  const checkRestart = async () => {
    if (eventCounter === 0) {
      logger.info('watcher: event counter is zero. restarting..')
      await startWatcher()
      return
    }

    eventCounter = 0
    setTimeout(checkRestart, 30000)
  }

  setTimeout(checkRestart, 30000)
}

export async function startPolling() {
  setTimeout(collectBlocks, 0)
  setTimeout(collectValidators, 1000)
  setTimeout(collectProposals, 2000)
}
