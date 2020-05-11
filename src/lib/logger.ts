import config from 'config'
import * as winston from 'winston'
import * as DailyRotateFile from 'winston-daily-rotate-file'

function pad(input: number | string, width: number, z = '0') {
  const n = typeof input === 'number' ? input.toString() : input
  return n.padStart(width, z)
}

function getDateString() {
  const d = new Date()
  return `${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)} ${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`
}

const print = winston.format.printf((info) => {
  const log = `${getDateString()} [${info.level.toUpperCase()}]: ${info.message}`

  return info.stack ? `${log}\n${info.stack}` : log
})

function createLogger(name: string) {
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.errors({ stack: true }), print),
    defaultMeta: { service: 'user-service' }
  })

  if (config.USE_LOG_FILE) {
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    logger.add(
      new DailyRotateFile({
        level: 'error',
        filename: `logs/${name}_error.log`, // log 폴더에 system.log 이름으로 저장
        zippedArchive: true // 압축여부
      })
    )

    logger.add(
      new DailyRotateFile({
        filename: `logs/${name}_combined.log`, // log 폴더에 system.log 이름으로 저장
        zippedArchive: true // 압축여부
      })
    )
  }

  if (!config.USE_LOG_FILE || process.env.HOST_ENV === 'docker') {
    logger.add(new winston.transports.Console())
  }

  return logger
}

export const apiLogger = createLogger('api')
export const collectorLogger = createLogger('collector')

export default apiLogger
