export async function timeoutPromise<T>(promise: Promise<T>, timeoutMs: number, failureMessage?: string): Promise<T> {
  let breaker: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    breaker = setTimeout(() => reject(new Error(failureMessage)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).then((result) => {
    clearTimeout(breaker)
    return result
  })
}
