import { getRepository, In } from 'typeorm'
import { without } from 'lodash'
import { ProposalEntity } from 'orm'
import config from 'config'

import { collectorLogger as logger } from 'lib/logger'

export async function removeDeletedProposals(proposalsInChain: LcdProposal[]) {
  logger.info('Checking for deleted proposals')

  const idsOnChain = proposalsInChain.map((proposal: LcdProposal) => proposal.id)
  const idsOnDB = await getRepository(ProposalEntity)
    .find({
      select: ['proposalId'],
      where: {
        chainId: config.CHAIN_ID
      }
    })
    .then((proposals) => proposals.map((p) => p.proposalId))

  // if db has [1,2,3,4] while chain has [1,2,3], result is [4]
  const deletedIds = without(idsOnDB, ...idsOnChain)

  if (deletedIds.length) {
    await getRepository(ProposalEntity).delete({
      proposalId: In(deletedIds)
    })

    logger.info(`Removed proposal with id: ${deletedIds.join(', ')}`)
  }
}
