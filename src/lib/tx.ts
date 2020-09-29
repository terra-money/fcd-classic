export function isSuccessfulTx(tx: Transaction.LcdTransaction) {
  return tx.code ? false : true
}
