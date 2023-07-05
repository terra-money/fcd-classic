import { currencyToDenom, isActiveCurrency } from 'lib/common'
import { div } from 'lib/math'
import * as lcd from 'lib/lcd'
import { isToken, getTotalSupply as getTokenTotalSupply } from 'service/token'

export async function getTotalSupply(input: string): Promise<string> {
  if (isToken(input)) {
    return getTokenTotalSupply(input)
  }

  const denom = isActiveCurrency(input) ? currencyToDenom(input.toLowerCase()) : input
  const supply = (await lcd.getTotalSupply()).find((c) => c.denom === denom)?.amount || '0'

  return input !== denom ? div(supply, 1000000) : supply
}
