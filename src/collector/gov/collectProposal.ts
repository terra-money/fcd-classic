import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'

import { removeDeletedProposals } from './removeDeletedProposals'
import { saveProposalDetails } from './saveProposal'

export async function collectProposal() {
  logger.info('Proposal collector started.')

  const proposals: LcdProposal[] = await lcd.getProposals()
  const proposalTallyingParams = await lcd.getProposalTallyingParams()
  const proposalDepositParams = await lcd.getProposalDepositParams()

  logger.info(`Got a list of ${proposals.length} proposals`)

  await removeDeletedProposals(proposals)

  for (const proposal of proposals) {
    try {
      logger.info(`Saving proposal ${proposal.id}`)
      await saveProposalDetails(proposal, proposalTallyingParams, proposalDepositParams)
    } catch (error) {
      logger.error(`Failed to save proposal ${proposal.id}`)
      logger.error(error)
    }
  }

  logger.info('Proposal collector completed.')
}
