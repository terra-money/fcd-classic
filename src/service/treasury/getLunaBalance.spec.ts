import 'jest-extended'
import getLunaBalance from './getLunaBalance'
import BigNumber from 'bignumber.js'

const WALLET_ADDRESS = 'terra12t890qauaz42ltzzx3rxj7gu74jvwmzw9659zn'

describe('getLunaBalance', () => {
  it('should retrieve positive number', async () => {
    expect(await getLunaBalance(WALLET_ADDRESS).then((strNum) => new BigNumber(strNum).isPositive())).toBeTrue()
  })
})
