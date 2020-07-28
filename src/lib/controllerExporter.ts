import config from 'config'
import { Logger } from 'winston'

export function controllerExporter(controllerID: string, controller, logger: Logger) {
  if (config.MODULES.indexOf(controllerID) === -1) {
    return undefined
  }
  logger.info(`Adding ${controllerID} controller module`)
  return new controller()
}
