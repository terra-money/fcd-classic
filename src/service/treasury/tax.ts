import { BOND_DENOM } from 'lib/constant'
import * as lcd from 'lib/lcd'
import { plus, div } from 'lib/math'

interface GetTaxProceedsReturn {
  total: string // total tax reward
  taxProceeds: TaxProceed[]
}

export async function getTaxProceeds(): Promise<GetTaxProceedsReturn> {
  const [lcdPricesObj, lcdTaxProceeds] = await Promise.all([lcd.getActiveOraclePrices(), lcd.getTaxProceeds()])
  let total = '0'

  const taxProceedsReducer = (acc: TaxProceed[], { denom, amount }: Coin): TaxProceed[] => {
    const denomPrice = (lcdPricesObj && lcdPricesObj[denom]) || NaN

    if (denom === BOND_DENOM) {
      total = plus(total, amount)
      return acc.concat({
        denom,
        amount,
        adjustedAmount: amount
      })
    }

    if (!denomPrice) {
      return acc
    }

    const adjustedAmount = div(amount, denomPrice)
    total = plus(total, adjustedAmount)

    return acc.concat({
      denom,
      amount,
      adjustedAmount
    })
  }

  const taxProceeds = Array.isArray(lcdTaxProceeds) ? lcdTaxProceeds.reduce(taxProceedsReducer, []) : []

  return {
    total,
    taxProceeds
  }
}
