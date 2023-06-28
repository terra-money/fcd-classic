import * as lcd from 'lib/lcd'
import memoizeCache from 'lib/memoizeCache'

async function getMoniker(valAddr: string): Promise<string> {
  const validator = await lcd.getValidator(valAddr)
  return validator?.description.moniker || ''
}

export default memoizeCache(getMoniker, { promise: true, maxAge: 3600000 /* 6 minutes */ })
