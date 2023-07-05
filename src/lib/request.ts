import { request as fetch, Agent } from 'undici'

const agent = new Agent({
  connect: {
    rejectUnauthorized: false
  }
})

export async function request(urlInput: string, params?: Record<string, unknown>) {
  const urlObj = new URL(urlInput)
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'terra-fcd'
    },
    dispatcher: agent
  }

  // If username exists, add it to
  if (urlObj.username) {
    const token = Buffer.from(`${urlObj.username}:${urlObj.password}`).toString('base64')
    options.headers['Authorization'] = `Basic ${token}`
  }

  // Set url from URL object to remove username:password in address
  let url = `${urlObj.origin}${urlObj.pathname}`

  // Append params to searchParams
  params &&
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined) {
        urlObj.searchParams.append(key, `${params[key]}`)
      }
    })

  // Append query string
  const qs = urlObj.searchParams.toString()
  if (qs.length) {
    url += `?${qs}`
  }

  return fetch(url, options)
}
