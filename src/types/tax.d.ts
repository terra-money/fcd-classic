interface TaxProceeds {
  total: number
  taxProceeds: TaxProceed[]
}

interface TaxProceed {
  denom: string
  amount: string
  adjustedAmount: string
}

interface DenomTaxCap {
  denom: string // denom name
  taxCap: string // tax cap for denom
}
