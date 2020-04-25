import got from 'got'

const serviceId = 'PL2L1RJ'
const espolicyId = 'P0619PR'
const pdEmail = 'aiden@terra.money'
const authorizationToken = 'bxkz5KvRUdu-fzU4GSYi'

const pdClient = got.extend({
  prefixUrl: 'https://api.pagerduty.com/',
  headers: {
    Authorization: `Token token=${authorizationToken}`,
    Accept: 'application/vnd.pagerduty+json;version=2',
    From: pdEmail
  },
  responseType: 'json'
})

export const create = async (title: string): Promise<string> => {
  const body = {
    incident: {
      type: 'incident',
      title,
      service: {
        id: serviceId,
        type: 'service_reference'
      },
      escalation_policy: {
        id: espolicyId,
        type: 'escalation_policy_reference'
      }
    }
  }

  const res = await pdClient.post('incidents', {
    json: body
  })
  return res && res.body
}

export const update = async (id: string, status: string): Promise<string> => {
  const body = {
    incident: {
      type: 'incident_reference',
      status
    }
  }

  const res = await pdClient.put(`incidents/${id}`, {
    json: body
  })
  return res && res.body
}
