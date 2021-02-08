import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'

import { removeDeletedProposals } from './removeDeletedProposals'
import { saveProposalDetails } from './saveProposal'
import { getValidatorsVotingPower } from 'service/governance'

export async function collectProposal() {
  logger.info('Proposal collector started.')

  const proposals: LcdProposal[] = await lcd.getProposals()
  const proposalTallyingParams = await lcd.getProposalTallyingParams()
  const proposalDepositParams = await lcd.getProposalDepositParams()
  const validatorsVotingPower = await getValidatorsVotingPower()

  await removeDeletedProposals(proposals)

  for (const proposal of proposals) {
    try {
      await saveProposalDetails(proposal, proposalTallyingParams, proposalDepositParams, validatorsVotingPower)
    } catch (error) {
      logger.error(`Failed to save proposal ${proposal.id}`)
      logger.error(error)
    }
  }

  logger.info('Proposal collector completed.')
}
