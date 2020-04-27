import * as lcd from 'lib/lcd'
import { get } from 'lodash'
import { getProposalBasic, getDepositInfo, ProposalStatus } from './helper'
import { ValidatorInfoEntity } from 'orm'
import { getRepository } from 'typeorm'
import { generateValidatorResponse } from 'service/staking/helper'

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
  deposit: {
    depositEndTime: string
    totalDeposit: Coin[]
    minDeposit: Coin[]
  }
  tallyingParameters?: LcdProposalTallyingParams
  content?: ProposalContent[]
  validatorsNotVoted?: ValidatorResponse[]
}

function makeContentArray(contentObj: { [key: string]: string | ProposalPramsModuleSpace[] }): ProposalContent[] {
  delete contentObj['title']
  delete contentObj['description']
  return Object.keys(contentObj).map((key) => {
    return {
      key,
      value: contentObj[key]
    }
  })
}

export default async function getProposal(
  proposalId: string,
  account?: string
): Promise<GetProposalResponse | undefined> {
  const proposal = await lcd.getProposal(proposalId)

  if (!proposal) {
    return
  }

  const depositParmas = await lcd.getProposalDepositParams()
  const proposalBasic = await getProposalBasic(proposal, depositParmas)

  if (!proposalBasic) {
    return
  }

  const content = get(proposal, 'content.value')
  const deposit = getDepositInfo(proposal, depositParmas)

  if (proposalBasic.status === ProposalStatus.VOTING) {
    const tallyingParameters = await lcd.getProposalTallyingParams()
    const proposalDetails = { ...proposalBasic, content: makeContentArray(content), deposit, tallyingParameters }

    if (!account) {
      return proposalDetails
    }

    const delegations = await lcd.getDelegations(account)

    if (!delegations || delegations.length === 0) {
      return {
        ...proposalDetails,
        validatorsNotVoted: []
      }
    }

    const delegatedOperatorList: string[] = delegations.reduce((acc: string[], validator) => {
      acc.push(validator.validator_address)
      return acc
    }, [])
    const delegatedValidator = await getRepository(ValidatorInfoEntity)
      .createQueryBuilder('validator')
      .where('validator.operator_address IN (:...ids)', { ids: delegatedOperatorList })
      .andWhere('validator.status = (:status)', { status: 'active' })
      .getMany()

    const validatorNotVoted = delegatedValidator.filter(
      (validator) => !(proposalBasic.vote && proposalBasic.vote.voters[validator.accountAddress])
    )

    const validatorsNotVoted = validatorNotVoted.reduce((acc, validator) => {
      acc.push(generateValidatorResponse(validator, { stakingReturn: '0', isNewValidator: false }))
      return acc
    }, [] as ValidatorResponse[])

    return {
      ...proposalDetails,
      validatorsNotVoted
    }
  }

  return { ...proposalBasic, content: makeContentArray(content), deposit }
}
