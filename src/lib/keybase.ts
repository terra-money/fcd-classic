import * as rp from 'request-promise'
import { get } from 'lodash'

import config from 'config'

import { localCache } from 'lib/cache'

export async function getIdentity(keybaseId: string) {
  const options = {
    method: 'GET'
  }
  const url = `${config.KEYBASE_URL_PREFIX}${keybaseId}`
  return rp(url, options)
}

function getAvatarFromIdentity(identity): string | undefined {
  try {
    if (!JSON.parse(identity).them) {
      return
    }

    return get(JSON.parse(identity).them[0], 'pictures.primary.url')
  } catch (e) {
    return
  }
}

async function getAvatar(keybaseId: string): Promise<string | undefined> {
  const identity = await getIdentity(keybaseId)
  return getAvatarFromIdentity(identity)
}

export default localCache(getAvatar, { promise: true, maxAge: 3600000 /* 6 minutes */ })
