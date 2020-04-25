import { init as initORM, DenomEntity } from 'orm'
import { getRepository } from 'typeorm'
import config from 'config'

async function resetDenoms() {
  return getRepository(DenomEntity).update({}, { active: false })
}

async function addDenom(name: string) {
  return getRepository(DenomEntity).save({ name, active: true })
}

const setTargets = async function () {
  await initORM()
  await resetDenoms()

  for (const name of config.ACTIVE_DENOMS) {
    let denom = await getRepository(DenomEntity).findOne({ name })

    if (!denom) {
      denom = await addDenom(name)
    } else {
      denom.active = true
      await getRepository(DenomEntity).save(denom)
    }
  }
}

setTargets().catch(console.error)
