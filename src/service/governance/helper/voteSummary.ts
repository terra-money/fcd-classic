import * as Bluebird from 'bluebird'
import * as lcd from 'lib/lcd'
import { plus, times, minus } from 'lib/math'
import { convertValAddressToAccAddress } from 'lib/common'
import { flatten, filter, reverse, uniqBy } from 'lodash'
import { errorReport } from 'lib/errorReporting'

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

function getVotersVotingPowerArr(validatorsVotingPower, delegations) {
  delegations.forEach((delegation) => {
    const { delegator_address: delegatorAddress, validator_address: validatorAddress, balance } = delegation
    const validator = filter(validatorsVotingPower, { operatorAddress: validatorAddress })[0]
    const delegator = filter(validatorsVotingPower, { accountAddress: delegatorAddress })[0]

    if (!validator) {
      errorReport(new Error(`ProposalVote: GET Validator Info Failed. ${validatorAddress}`))
    }

    validator.votingPower = minus(validator.votingPower, balance)
    if (delegator) {
      delegator.votingPower = plus(delegator.votingPower, balance)
    } else {
      validatorsVotingPower.push({
        accountAddress: delegatorAddress,
        votingPower: balance
      })
    }
  })
  return validatorsVotingPower
}

export function getVoteCounts(votes: LcdProposalVote[]): VoteCount {
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

export async function getValidatorsVotingPower() {
  const [votingPower, validators] = await Promise.all([lcd.getVotingPower(), lcd.getValidators()])

  return validators.map((item) => {
    const accAddr = convertValAddressToAccAddress(item.operator_address)

    return {
      accountAddress: accAddr,
      operatorAddress: item.operator_address,
      votingPower: times(votingPower.votingPowerByPubKey[item.consensus_pubkey], '1000000')
    }
  })
}

async function getLunaStaked() {
  const stakingPool = await lcd.getStakingPool()
  return stakingPool && stakingPool.bonded_tokens
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

export async function getVoteSummary(proposal: LcdProposal): Promise<VoteSummary | undefined> {
  const { id, voting_end_time: votingEndTime } = proposal
  const stakedLuna = await getLunaStaked()
  const votes = await lcd.getProposalVotes(id)

  if (!votes) {
    return
  }

  const uniqueVotes = uniqBy(reverse(votes), 'voter') // can vote multiple times
  const votersDelegations = flatten(await Bluebird.map(uniqueVotes, (vote) => lcd.getDelegations(vote.voter)))
  const validatorsVotingPower = await getValidatorsVotingPower()
  const votersVotingPowerArr = getVotersVotingPowerArr(validatorsVotingPower, votersDelegations)

  uniqueVotes.forEach((vote) => {
    const votingPower = filter(votersVotingPowerArr, { accountAddress: vote.voter })[0]

    if (!votingPower) {
      return
    }

    vote['votingPower'] = votingPower.votingPower
  })

  const { distribution, total } = await getVoteDistributionAndTotal(proposal, uniqueVotes)
  const count = getVoteCounts(uniqueVotes)

  const votesObj = votes.reduce((acc, vote: LcdProposalVote) => {
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
