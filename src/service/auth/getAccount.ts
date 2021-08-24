import Mempool from 'lib/mempool'
import * as lcd from 'lib/lcd'
import normalizeAccount from '../bank/getBalance/normalizeAccount'

export async function getAccount(address: string) {
  const account = normalizeAccount(await lcd.getAccount(address))

  return {
    ...account.value,
    sequence: (+account.value.sequence + Mempool.getTransactionsByAddress(address).length).toString()
  }
}
