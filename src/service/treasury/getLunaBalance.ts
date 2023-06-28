import * as lcd from 'lib/lcd'
import BigNumber from 'bignumber.js'

async function getLunaBalance(address: string): Promise<string> {
  const [balance, delegations, unbondings] = await Promise.all([
    lcd.getBalance(address),
    lcd.getDelegations(address),
    lcd.getUnbondingDelegations(address)
  ])

  const coin = balance.find((c) => c.denom === 'uluna')
  const bankAmount = new BigNumber(coin?.amount || 0)
  const delegationsAmount = delegations.reduce((prev, curr) => prev.plus(curr.balance.amount), new BigNumber(0))
  const unbodingsAmount = unbondings.reduce(
    (prev, curr) => curr.entries.reduce((pe, ce) => pe.plus(ce.balance), prev),
    new BigNumber(0)
  )

  return bankAmount.plus(delegationsAmount).plus(unbodingsAmount).toString()
}

export default getLunaBalance
