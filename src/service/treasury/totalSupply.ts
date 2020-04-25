import { currencyToDenom, isActiveCurrency } from 'lib/common'
import { div } from 'lib/math'
import * as lcd from 'lib/lcd'

export async function getTotalSupply(input: string): Promise<string> {
  const denom = isActiveCurrency(input) ? currencyToDenom(input.toLowerCase()) : input
  const response = await lcd.getIssuanceByDenom(denom)

  if (response.denom !== denom) {
    throw new Error('denom in response is differ from input')
  }

  return input !== denom ? div(response.issuance, 1000000) : response.issuance
}
