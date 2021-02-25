import * as Bluebird from 'bluebird'
import { EntityManager, getManager } from 'typeorm'
import { TxEntity } from 'orm'
import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'

import { removeDeletedProposals } from './removeDeletedProposals'
import { saveProposalDetails } from './saveProposal'
import { getValidatorsVotingPower } from 'service/governance'

export async function detectAndUpdateProposal(mgr: EntityManager, txs: TxEntity[]) {
  const proposalUpdateSet = new Set<string>()

  txs.forEach((tx) => {
    if (Array.isArray(tx.data.logs)) {
      tx.data.logs.forEach((log) => {
        if (Array.isArray(log.events)) {
          log.events.forEach((event) => {
            if (Array.isArray(event.attributes)) {
              event.attributes.forEach((attr) => {
                if (attr.key === 'proposal_id') {
                  if (!Number.isNaN(parseInt(attr.value, 10))) {
                    proposalUpdateSet.add(attr.value)
                  }
                }
              })
            }
          })
        }
      })
    }
  })

  if (proposalUpdateSet.size) {
    const proposalIds = Array.from(proposalUpdateSet.values())
    const [proposalTallyingParams, proposalDepositParams] = await Promise.all([
      lcd.getProposalTallyingParams(),
      lcd.getProposalDepositParams()
    ])
    const validatorsVotingPower = await getValidatorsVotingPower()

    await Bluebird.mapSeries(proposalIds, (id) =>
      lcd
        .getProposal(id)
        .then((proposal) =>
          saveProposalDetails(mgr, proposal, proposalTallyingParams, proposalDepositParams, validatorsVotingPower)
        )
    )
  }
}

export async function collectProposals() {
  logger.info('Proposal collector started.')

  const proposals: LcdProposal[] = await lcd.getProposals()
  const proposalTallyingParams = await lcd.getProposalTallyingParams()
  const proposalDepositParams = await lcd.getProposalDepositParams()
  const validatorsVotingPower = await getValidatorsVotingPower()

  await removeDeletedProposals(proposals)

  for (const proposal of proposals) {
    try {
      await saveProposalDetails(
        getManager(),
        proposal,
        proposalTallyingParams,
        proposalDepositParams,
        validatorsVotingPower
      )
    } catch (error) {
      logger.error(`Failed to save proposal ${proposal.id}`)
      logger.error(error)
    }
  }

  logger.info('Proposal collector completed.')
}
