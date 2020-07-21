import * as memoizee from 'memoizee'

import config from 'config'

type CacheOption = {
  promise: boolean
  maxAge: number
  preFetch?: number
}

export function localCache<F extends (...args: any[]) => any>(fn: F, options: CacheOption): F {
  if (config.CHAIN_ID === 'localterra') {
    return fn
  }
  return memoizee(fn, options)
}
