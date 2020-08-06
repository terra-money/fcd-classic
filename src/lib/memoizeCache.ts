import * as memoizee from 'memoizee'
import config from 'config'
import { LOCAL_TERRA_CHAIN_ID } from './constant'

export default function cache<F extends (...args: any[]) => any>(
  fn: F,
  options?: memoizee.Options<F>
): (F & memoizee.Memoized<F>) | F {
  if (config.CHAIN_ID === LOCAL_TERRA_CHAIN_ID) {
    return fn
  }

  return memoizee(fn, options)
}
