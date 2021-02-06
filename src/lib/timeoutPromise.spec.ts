import 'jest-extended'

import { timeoutPromise } from './timeoutPromise'

describe('Promise timeout', () => {
  test('Test in promise', async () => {
    const resp = await timeoutPromise(
      new Promise((res) => {
        res('success')
      }),
      1000,
      'failed to get value'
    )
    expect(resp).toBe('success')
  })

  test('Test promise force failure', async () => {
    const resp = await timeoutPromise(
      new Promise((res, rej) => {
        rej('failed')
      }),
      1000,
      'failed to get value'
    ).catch((e) => {
      return e
    })

    expect(resp).toBe('failed')
  })

  test('Test timeout in promise timeout failed', async () => {
    let timer: NodeJS.Timeout
    const promise = new Promise((res) => {
      timer = setTimeout(() => {
        res('success')
      }, 5000)
    })
    const resp = await timeoutPromise(promise, 1000, 'failed').catch((e) => {
      clearTimeout(timer)
      return e.message
    })
    expect(resp).toBe('failed')
  })

  test('Test timeout in promise success', async () => {
    let timer: NodeJS.Timeout
    const promise = new Promise((res) => {
      timer = setTimeout(() => {
        res('success')
      }, 2000)
    })
    const resp = await timeoutPromise(promise, 5000, 'failed due to timeout').then((res) => {
      clearTimeout(timer)
      return res
    })
    expect(resp).toBe('success')
  })

  test('Test timeout in with promise array success', async () => {
    let timer1: NodeJS.Timeout
    const promise1 = new Promise((res) => {
      timer1 = setTimeout(() => {
        res('success')
      }, 2000)
    })

    let timer2: NodeJS.Timeout
    const promise2 = new Promise((res) => {
      timer2 = setTimeout(() => {
        res('success')
      }, 2000)
    })

    const promises = Promise.all([promise1, promise2])
    const resp = await timeoutPromise(promises, 5000, 'failed due to timeout').then((res) => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      return res
    })
    expect(resp).toBeArrayOfSize(2)
    expect(resp[0]).toBe('success')
    expect(resp[1]).toBe('success')
  })

  test('Test timeout in with promise array timeout for one promise', async () => {
    let timer1: NodeJS.Timeout
    const promise1 = new Promise((res) => {
      timer1 = setTimeout(() => {
        res('success')
      }, 2000)
    })

    let timer2: NodeJS.Timeout
    const promise2 = new Promise((res) => {
      timer2 = setTimeout(() => {
        res('success')
      }, 5000)
    })

    const promises = Promise.all([promise1, promise2])
    const resp = await timeoutPromise(promises, 3000, 'failed')
      .then((res) => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        return res
      })
      .catch((e) => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        return e.message
      })
    expect(resp).toBe('failed')
  })

  test('Test timeout in with promise array timeout for all promise', async () => {
    let timer1: NodeJS.Timeout
    const promise1 = new Promise((res) => {
      timer1 = setTimeout(() => {
        res('success')
      }, 5000)
    })

    let timer2: NodeJS.Timeout
    const promise2 = new Promise((res) => {
      timer2 = setTimeout(() => {
        res('success')
      }, 5000)
    })

    const promises = Promise.all([promise1, promise2])
    const resp = await timeoutPromise(promises, 3000, 'failed')
      .then((res) => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        return res
      })
      .catch((e) => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        return e.message
      })
    expect(resp).toBe('failed')
  })
})
