import * as Bluebird from 'bluebird'
import BigNumber from 'bignumber.js'
import * as lcd from 'lib/lcd'
import config from 'config'
import memoizeCache from 'lib/memoizeCache'
import { getTotalSupply } from './token'

// ANC in terra1mxf7d5updqxfgvchd7lv6575ehhm8qfdttuqzz (future borrower rewards)
// ANC in terra12wk8dey0kffwp27l5ucfumczlsc9aned8rqueg (community pool)
// ANC in terra146ahqn6d3qgdvmj8cj96hh03dzmeedhsf0kxqm (unclaimed airdrops)
// ANC in terra1897an2xux840p9lrh6py3ryankc6mspw49xse3 (future LP rewards)
// ANC in terra1pm54pmw3ej0vfwn3gtn6cdmaqxt0x37e9jt0za (team allocation)
// ANC in terra10evq9zxk2m86n3n3xnpw28jpqwp628c6dzuq42 (investor allocation)
// ANC in foundation wallet
export async function getAnchorBalance(address: string): Promise<string> {
  const res = await lcd.getContractStore(config.ANCHOR_TOKEN_ADDRESS, { balance: { address } })

  if (!res || typeof res.balance !== 'string') {
    return ''
  }

  return res.balance as string
}

export async function getCirculatingSupplyRaw(): Promise<string> {
  const [results, totalSupply] = await Promise.all([
    Bluebird.map(config.BANK_WALLETS, getAnchorBalance),
    getTotalSupply('anc')
  ])

  const sum = results.reduce((p, c) => p.plus(c), new BigNumber('0')).div(1000000)
  return new BigNumber(totalSupply).minus(sum).toString()
}

export const getCirculatingSupply = memoizeCache(getCirculatingSupplyRaw, {
  promise: true,
  maxAge: 5 * 60 * 1000 /* 5 minutes */
})
