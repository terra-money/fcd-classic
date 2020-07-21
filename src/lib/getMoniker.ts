import { get } from 'lodash'

import * as lcd from 'lib/lcd'
import { localCache } from 'lib/cache'

async function getMoniker(valAddr: string): Promise<string> {
  const validator = await lcd.getValidator(valAddr)
  return get(validator, 'description.moniker', '')
}

export default localCache(getMoniker, { promise: true, maxAge: 3600000 /* 6 minutes */ })
