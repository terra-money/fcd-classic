import * as rp from 'request-promise'
import config from 'config'
import { get } from 'lodash'
import * as memoizee from 'memoizee'

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

export default memoizee(getAvatar, { promise: true, maxAge: 3600000 })
