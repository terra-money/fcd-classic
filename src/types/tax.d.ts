interface TaxProceeds {
  total: number
  taxProceeds: TaxProceed[]
}

interface TaxProceed {
  denom: string
  amount: string
  adjustedAmount: string
}
