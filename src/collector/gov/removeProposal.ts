import { getRepository, In } from 'typeorm'

import { ProposalEntity } from 'orm'
import config from 'config'

import { collectorLogger as logger } from 'lib/logger'

export async function removeProposalsDeletedFromChain(proposalsInChain: LcdProposal[]) {
  logger.info('Checking for deleted proposals')
  const idsOnChain = proposalsInChain.map((proposal: LcdProposal) => proposal.id)

  const proposalsInDb = await getRepository(ProposalEntity).find({
    select: ['id', 'proposalId'],
    where: {
      chainId: config.CHAIN_ID
    }
  })

  const deletedProposals = proposalsInDb.filter((proposal) => idsOnChain.indexOf(proposal.proposalId) === -1)

  if (deletedProposals.length) {
    await getRepository(ProposalEntity).delete({
      id: In(deletedProposals.map((proposal) => proposal.id))
    })
    logger.info(`Removed proposal with id: ${deletedProposals.map((prop) => prop.proposalId).join(', ')}`)
  }
}
