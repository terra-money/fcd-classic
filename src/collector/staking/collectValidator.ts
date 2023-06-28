import * as Bluebird from 'bluebird'
import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { ValidatorInfoEntity, ValidatorStatus } from 'orm'
import { getRepository } from 'typeorm'

import { saveValidatorDetail } from './validatorDetails'

export async function collectValidator() {
  const [extValidators, activePrices] = await Promise.all([
    lcd.getValidatorsAndConsensus(),
    lcd.getActiveOraclePrices()
  ])

  logger.info(`collectValidator: total ${extValidators.length} validators`)

  // Set inactive for absent validators
  await getRepository(ValidatorInfoEntity)
    .createQueryBuilder()
    .update()
    .set({ status: ValidatorStatus.INACTIVE })
    .where('operator_address NOT IN (:...ids)', { ids: extValidators.map((e) => e.lcdValidator.operator_address) })
    .execute()

  await Bluebird.mapSeries(extValidators, (extValidator) =>
    saveValidatorDetail(extValidator, activePrices).catch((error) => {
      logger.error('collectValidator:', error)
    })
  )

  logger.info('collectValidator: end')
}
