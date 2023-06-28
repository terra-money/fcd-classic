import { request } from 'undici'
import { get } from 'lodash'

import memoizeCache from 'lib/memoizeCache'

import config from 'config'

function queryUser(keybaseId: string): Promise<Keybase.Root> {
  const url = `${config.KEYBASE_URL_PREFIX}${keybaseId}`
  return request(url).then((res) => res.body.json())
}

async function getAvatar(keybaseId: string): Promise<string | undefined> {
  const user = await queryUser(keybaseId)
  return get(user, 'them[0].pictures.primary.url')
}

export default memoizeCache(getAvatar, { promise: true, maxAge: 3600000 /* 6 minutes */ })

// async function main() {
//   console.log(await getAvatar('4C3971062C6FDB9D'))
// }

// main().catch(console.error)
