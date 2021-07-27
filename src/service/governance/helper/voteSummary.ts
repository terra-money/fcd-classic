import { reverse, uniqBy } from 'lodash'
import * as Bluebird from 'bluebird'

import * as lcd from 'lib/lcd'
import { plus, times, minus } from 'lib/math'
import { convertAddress } from 'lib/common'
import { errorReport } from 'lib/errorReporting'

export type ValidatorVotingPower = {
  accountAddress: string
  operatorAddress: string
  votingPower: string
}

function tallying(votes): TallyingInfo {
  const initial = {
    Yes: '0',
    No: '0',
    NoWithVeto: '0',
    Abstain: '0'
  }
  let total = '0'

  const distribution = votes.reduce((acc, vote) => {
    if (!(vote.option in acc)) {
      return acc
    }

    acc[vote.option] = plus(acc[vote.option], vote.votingPower)
    total = plus(vote.votingPower, total)
    return acc
  }, initial)

  return { total, distribution }
}

function getVotersVotingPowerArr(
  validatorsVotingPower: ValidatorVotingPower[],
  delegations: LcdStakingDelegation[]
): ValidatorVotingPower[] {
  delegations.forEach((delegation) => {
    const { delegator_address: delegatorAddress, validator_address: validatorAddress, shares } = delegation
    const validator = validatorsVotingPower.find((v) => v.operatorAddress === validatorAddress)
    const delegator = validatorsVotingPower.find((v) => v.accountAddress === delegatorAddress)

    if (!validator) {
      errorReport(new Error(`ProposalVote: cannot find validator ${validatorAddress}`))
      return
    }

    validator.votingPower = minus(validator.votingPower, shares)

    if (delegator) {
      delegator.votingPower = plus(delegator.votingPower, shares)
    } else {
      validatorsVotingPower.push({
        operatorAddress: validatorAddress,
        accountAddress: delegatorAddress,
        votingPower: shares
      })
    }
  })
  return validatorsVotingPower
}

function getVoteCount(votes: LcdProposalVote[]): VoteCount {
  const initial = {
    Yes: 0,
    No: 0,
    NoWithVeto: 0,
    Abstain: 0
  }

  return votes.reduce((acc, vote) => {
    if (!(vote.option in acc)) {
      return acc
    }

    acc[vote.option] = acc[vote.option] + 1
    return acc
  }, initial)
}

export async function getValidatorsVotingPower(): Promise<ValidatorVotingPower[]> {
  const [votingPower, validators] = await Promise.all([lcd.getVotingPower(), lcd.getValidators()])

  return validators.map((item) => {
    const accAddr = convertAddress('terra', item.operator_address)

    return {
      accountAddress: accAddr,
      operatorAddress: item.operator_address,
      votingPower: times(votingPower.votingPowerByPubKey[item.consensus_pubkey], '1000000')
    }
  })
}

async function getVoteDistributionAndTotal(proposal: LcdProposal, votes: LcdProposalVote[]) {
  if (proposal.proposal_status === 'VotingPeriod') {
    const { distribution, total } = tallying(votes)
    return { distribution, total }
  }

  const tally = await lcd.getProposalTally(proposal.id)

  const distribution = {
    Yes: tally ? tally['yes'] : '0',
    No: tally ? tally['no'] : '0',
    NoWithVeto: tally ? tally['no_with_veto'] : '0',
    Abstain: tally ? tally['abstain'] : '0'
  }
  const total = Object.keys(distribution).reduce((acc: string, key: string) => plus(distribution[key], acc), '0')
  return { distribution, total }
}

export async function getVoteSummary(
  proposal: LcdProposal,
  votes: LcdProposalVote[],
  validatorsVotingPower: ValidatorVotingPower[]
): Promise<VoteSummary | undefined> {
  const { id, voting_end_time: votingEndTime } = proposal
  const { bonded_tokens: stakedLuna } = await lcd.getStakingPool()

  const uniqueUserVotes = uniqBy(reverse(votes), 'voter') // can vote multiple times, doing reverse will took the latest votes
  const votersDelegations = (await Bluebird.map(uniqueUserVotes, (vote) => lcd.getDelegations(vote.voter))).flat()
  const votersVotingPowerArr = getVotersVotingPowerArr(validatorsVotingPower, votersDelegations)

  uniqueUserVotes.forEach((vote) => {
    const votingPower = votersVotingPowerArr.find((v) => v.accountAddress === vote.voter)

    if (!votingPower) {
      return
    }

    vote['votingPower'] = votingPower.votingPower
  })

  const { distribution, total } = await getVoteDistributionAndTotal(proposal, uniqueUserVotes)
  const count = getVoteCount(uniqueUserVotes)

  const votesObj = uniqueUserVotes.reduce((acc, vote: LcdProposalVote) => {
    acc[vote.voter] = vote.option
    return acc
  }, {})

  return {
    id,
    distribution,
    count,
    total,
    votingEndTime,
    stakedLuna,
    voters: votesObj
  }
}
