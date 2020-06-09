const {
  SERVER_PORT,
  CHAIN_ID,
  LCD_URI,
  FCD_URI,
  RPC_URI,
  BYPASS_URI,
  STATION_STATUS_JSON,
  SENTRY_DSN,
  SC_AUTH_KEY,
  USE_LOG_FILE,
  HEIGHT_REPORT_INTERVAL,
  TAX_CAP_TARGETS,
  ACTIVE_DENOMS,
  ACTIVE_CURRENCY
} = process.env

const config = {
  ORM: 'default',
  PORT: SERVER_PORT ? +SERVER_PORT : 3060,
  CHAIN_ID: CHAIN_ID || 'soju-0014',
  LCD_URI: LCD_URI || 'https://soju-lcd.terra.dev',
  FCD_URI: FCD_URI || 'https://soju-fcd.terra.dev',
  RPC_URI: RPC_URI || 'http://15.164.46.6:26657',
  BYPASS_URI: BYPASS_URI || 'https://soju-lcd.terra.dev',
  STATION_STATUS_JSON_URL: STATION_STATUS_JSON || 'https://terra.money/station/version-web.json',
  SENTRY_DSN,
  SC_AUTH_KEY,
  USE_LOG_FILE: USE_LOG_FILE ? true : false,
  // Keybase for fetching validator avatar image
  KEYBASE_URL_PREFIX: `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=`,
  // Reporter module
  HEIGHT_REPORT_INTERVAL: HEIGHT_REPORT_INTERVAL ? +HEIGHT_REPORT_INTERVAL : 5000,
  // Chain parameters
  TAX_CAP_TARGETS: TAX_CAP_TARGETS ? (JSON.parse(TAX_CAP_TARGETS) as string[]) : ['usdr'],
  ACTIVE_DENOMS: ACTIVE_DENOMS ? (JSON.parse(ACTIVE_DENOMS) as string[]) : ['uluna', 'usdr', 'ukrw', 'uusd', 'umnt'],
  ACTIVE_CURRENCY: ACTIVE_CURRENCY
    ? (JSON.parse(ACTIVE_CURRENCY) as string[])
    : ['luna', 'sdr', 'sdt', 'krw', 'krt', 'usd', 'ust', 'mnt']
}

export default config
