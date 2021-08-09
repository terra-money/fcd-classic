import * as Bluebird from 'bluebird'
import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'

import { saveValidatorDetail } from './validatorDetails'

export async function collectValidator() {
  const [validatorList, votingPower, activePrices] = await Promise.all([
    lcd.getValidators(),
    lcd.getVotingPower(),
    lcd.getActiveOraclePrices()
  ])

  logger.info(`collectValidator: total ${validatorList.length} validators`)

  await Bluebird.mapSeries(validatorList, (lcdValidator) =>
    saveValidatorDetail({ lcdValidator, activePrices, votingPower }).catch((error) => {
      logger.error('collectValidator:', error)
    })
  )

  logger.info('collectValidator: end')
}
