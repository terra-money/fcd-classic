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
  ACTIVE_CURRENCY,
  DISABLE_API,
  DISABLE_SOCKET,
  EXCLUDED_ROUTES,
  MIN_GAS_PRICES,
  FOUNDATION_WALLET_ADDRESS,
  PRUNING_KEEP_EVERY
} = process.env

const config = {
  ORM: 'default',
  PORT: SERVER_PORT ? +SERVER_PORT : 3060,
  CHAIN_ID: CHAIN_ID || 'tequila-0004',
  LCD_URI: LCD_URI || 'https://tequila-lcd.terra.dev',
  FCD_URI: FCD_URI || 'https://tequila-fcd.terra.dev',
  RPC_URI: RPC_URI || 'http://localhost:26657',
  BYPASS_URI: BYPASS_URI || 'https://tequila-lcd.terra.dev',
  STATION_STATUS_JSON_URL: STATION_STATUS_JSON || 'https://terra.money/station/version-web.json',
  FOUNDATION_WALLET_ADDRESS: FOUNDATION_WALLET_ADDRESS || '',
  SENTRY_DSN,
  SC_AUTH_KEY,
  USE_LOG_FILE: !!JSON.parse(USE_LOG_FILE || 'true'),
  DISABLE_API: !!JSON.parse(DISABLE_API || 'false'),
  DISABLE_SOCKET: !!JSON.parse(DISABLE_SOCKET || 'false'),
  // Keybase for fetching validator avatar image
  KEYBASE_URL_PREFIX: `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=`,
  // Reporter module
  HEIGHT_REPORT_INTERVAL: HEIGHT_REPORT_INTERVAL ? +HEIGHT_REPORT_INTERVAL : 5000,
  // Chain parameters
  TAX_CAP_TARGETS: TAX_CAP_TARGETS ? (JSON.parse(TAX_CAP_TARGETS) as string[]) : ['usdr'],
  ACTIVE_DENOMS: ACTIVE_DENOMS
    ? (JSON.parse(ACTIVE_DENOMS) as string[])
    : ['uluna', 'usdr', 'ukrw', 'uusd', 'umnt', 'ueur'],
  ACTIVE_CURRENCY: ACTIVE_CURRENCY
    ? (JSON.parse(ACTIVE_CURRENCY) as string[])
    : ['luna', 'sdr', 'sdt', 'krw', 'krt', 'usd', 'ust', 'mnt', 'eur', 'eut'],
  EXCLUDED_ROUTES: EXCLUDED_ROUTES
    ? (JSON.parse(EXCLUDED_ROUTES) as string[]).map((regExp) => new RegExp(regExp))
    : [
        /* /\/wasm\// */
      ],
  MIN_GAS_PRICES: MIN_GAS_PRICES
    ? (JSON.parse(MIN_GAS_PRICES) as CoinByDenoms)
    : ({
        uluna: '0.015',
        usdr: '0.015',
        uusd: '0.015',
        ukrw: '0.015',
        umnt: '0.015'
      } as CoinByDenoms),
  PRUNING_KEEP_EVERY: parseInt(PRUNING_KEEP_EVERY || '100', 10) || 100
}

export default config
