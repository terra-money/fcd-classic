import * as Bluebird from 'bluebird'
import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'

import { saveValidatorDetail } from './validatorDetails'

export async function collectValidator() {
  logger.info('Validator collector started.')

  const [extValidators, activePrices] = await Promise.all([lcd.getExtendedValidators(), lcd.getActiveOraclePrices()])

  logger.info(`Got a list of ${extValidators.length} validators`)

  await Bluebird.mapSeries(extValidators, (extValidator) =>
    saveValidatorDetail(extValidator, activePrices).catch((error) => {
      logger.error(error)
    })
  )

  logger.info('Validator collector completed.')
}
