import * as memoizee from 'memoizee'

import config from 'config'

import { LOCAL_TERRA_CHAIN_ID } from './constant'

type CacheOption = {
  promise: boolean
  maxAge: number
  preFetch?: number
}

export function localCache<F extends (...args: any[]) => any>(fn: F, options: CacheOption): F {
  if (config.CHAIN_ID === LOCAL_TERRA_CHAIN_ID) {
    return fn
  }
  return memoizee(fn, options)
}
