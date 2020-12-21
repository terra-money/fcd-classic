import * as lcd from 'lib/lcd'
import BigNumber from 'bignumber.js'

async function getLunaBalance(address: string): Promise<string> {
  let amount = new BigNumber(0)
  const [account, delegations, unbondings] = await Promise.all([
    lcd.getAccount(address),
    lcd.getDelegations(address),
    lcd.getUnbondingDelegations(address)
  ])

  const coin = (account as LazyVestingAccount).value.coins?.find((c) => c.denom === 'uluna')

  if (coin) {
    // console.log(`bank: ${coin.amount}`)
    amount = amount.plus(coin.amount)
  }

  delegations.forEach((d) => {
    // console.log(`delegation: ${d.balance.amount} ${d.validator_address}`)
    amount = amount.plus(d.balance.amount)
  })

  unbondings.forEach((u) =>
    u.entries.forEach((e) => {
      // console.log(`unbonding: ${e.balance}`)
      amount = amount.plus(e.balance)
    })
  )

  return amount.toString()
}

export default getLunaBalance
