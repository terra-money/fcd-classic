import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { saveValidatorDetail } from './validatorDetails'

export async function saveValidatorInfo() {
  logger.info('Updating validator info....')
  const validatorList = await lcd.getValidators()
  logger.info(`Got a list of ${validatorList.length} validators`)
  const votingPower = await lcd.getVotingPower()
  const activePrices = await lcd.getActiveOraclePrices()

  for (const lcdValidator of validatorList) {
    logger.info(`Updating validator ${lcdValidator.operator_address}`)

    try {
      await saveValidatorDetail({ lcdValidator, activePrices, votingPower })
      logger.info('Update complete')
    } catch (error) {
      logger.info('Could not save validator info due to error ', lcdValidator.operator_address)
      logger.error(error)
    }
  }

  logger.info('Scraping validator info complete')
}
