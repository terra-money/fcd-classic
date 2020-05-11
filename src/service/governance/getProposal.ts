import { getRepository } from 'typeorm'

import * as lcd from 'lib/lcd'
import { getProposalBasic, ProposalStatus } from './helper'
import { ValidatorInfoEntity, ProposalEntity } from 'orm'
import { generateValidatorResponse } from 'service/staking/helper'
import { getValidatorsReturn } from 'service/staking/getValidators'
import config from 'config'
import { APIError, ErrorTypes } from 'lib/error'

interface ProposalPramsModuleSpace {
  subspace: string // module
  key: string // key name of the module
  value: string // proposed value of key
}

interface ProposalContent {
  key: string // content type like changes
  value: ProposalPramsModuleSpace[] | string // value m
}

interface GetProposalResponse extends ProposalBasic {
  tallyingParameters?: LcdProposalTallyingParams
  content?: ProposalContent[]
  validatorsNotVoted?: ValidatorResponse[]
}

function makeContentArray(contentObj: ProposalContentValue): ProposalContent[] {
  delete contentObj['title']
  delete contentObj['description']
  return Object.keys(contentObj).map((key) => {
    return {
      key,
      value: contentObj[key]
    }
  })
}

async function getDelegatedValidatorWhoDidNotVoted(
  account: string,
  voters: { [operatorAddr: string]: string }
): Promise<ValidatorResponse[]> {
  const delegations = await lcd.getDelegations(account)

  if (!delegations || delegations.length === 0) {
    return []
  }

  const delegatedOperatorList: string[] = delegations.map((validator: LcdDelegation) => {
    return validator.validator_address
  })
  const delegatedValidator = await getRepository(ValidatorInfoEntity)
    .createQueryBuilder('validator')
    .where('validator.operator_address IN (:...ids)', { ids: delegatedOperatorList })
    .andWhere('validator.status = (:status)', { status: 'active' })
    .getMany()

  const validatorNotVoted = delegatedValidator.filter((validator) => !voters[validator.accountAddress])

  const validatorsReturn = getValidatorsReturn()

  const validatorsNotVoted = validatorNotVoted.reduce((acc, validator) => {
    acc.push(
      generateValidatorResponse(
        validator,
        validatorsReturn[validator.operatorAddress] || { stakingReturn: '0', isNewValidator: false }
      )
    )
    return acc
  }, [] as ValidatorResponse[])
  return validatorsNotVoted
}

export default async function getProposal(proposalId: string, account?: string): Promise<GetProposalResponse> {
  const proposal = await getRepository(ProposalEntity).findOne({
    proposalId,
    chainId: config.CHAIN_ID
  })

  if (!proposal) {
    throw new APIError(ErrorTypes.NOT_FOUND_ERROR, '', 'Proposal not found')
  }

  const proposalBasic: ProposalBasic = await getProposalBasic(proposal)

  const content = makeContentArray(proposal.content.value)

  const tallyingParameters = proposal.tallyingParameters

  const proposalDetails = {
    ...proposalBasic,
    content,
    tallyingParameters
  }

  if (!account || proposalBasic.status !== ProposalStatus.VOTING) {
    return proposalDetails
  }

  return {
    ...proposalDetails,
    validatorsNotVoted: await getDelegatedValidatorWhoDidNotVoted(account, proposalBasic.vote?.voters || {})
  }
}
