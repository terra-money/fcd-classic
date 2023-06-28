const {
  SERVER_PORT,
  LCD_URI,
  FCD_URI,
  RPC_URI,
  BYPASS_URI,
  STATION_STATUS_JSON,
  SENTRY_DSN,
  USE_LOG_FILE,
  ACTIVE_DENOMS,
  ACTIVE_CURRENCY,
  DISABLE_API,
  EXCLUDED_ROUTES,
  MIN_GAS_PRICES,
  PRUNING_KEEP_EVERY,
  BANK_WALLETS,
  ANCHOR_BANK_WALLETS,
  ANCHOR_TOKEN_ADDRESS,
  ORACLE_SLASH_WINDOW,
  TOKEN_NETWORK
} = process.env

const CHAIN_ID = process.env.CHAIN_ID || 'columbus-5'
let INITIAL_HEIGHT = parseInt(process.env.INITIAL_HEIGHT || '')

if (isNaN(INITIAL_HEIGHT) || INITIAL_HEIGHT <= 0) {
  if (CHAIN_ID === 'columbus-5') {
    INITIAL_HEIGHT = 4724001
  } else {
    INITIAL_HEIGHT = 1
  }
}

const config = {
  ORM: 'default',
  CHAIN_ID,
  INITIAL_HEIGHT,
  SERVER_PORT: SERVER_PORT ? +SERVER_PORT : 3060,
  LCD_URI: LCD_URI || 'https://lcd.terrarebels.net',
  FCD_URI: FCD_URI || 'https://fcd.terrarebels.net',
  RPC_URI: RPC_URI || 'http://localhost:26657',
  BYPASS_URI: BYPASS_URI || 'https://lcd.terrarebels.net',
  STATION_STATUS_JSON_URL: STATION_STATUS_JSON || 'https://terra.money/station/version-web.json',
  BANK_WALLETS: BANK_WALLETS ? (JSON.parse(BANK_WALLETS) as string[]) : [],
  TOKEN_NETWORK: TOKEN_NETWORK,
  ANCHOR_BANK_WALLETS: ANCHOR_BANK_WALLETS
    ? (JSON.parse(ANCHOR_BANK_WALLETS) as string[])
    : [
        'terra1z7nxemcnm8kp7fs33cs7ge4wfuld307v80gypj',
        'terra17g577z0pqt6tejhceh06y3lyeudfs3v90mzduy',
        'terra1u5ywhlve3wugzqslqvm8ks2j0nsvrqjx0mgxpk',
        'terra19nxz35c8f7t3ghdxrxherym20tux8eccar0c3k',
        'terra1ee2l402v29yuem86uf29v9d6894fg3k6f5aj8f',
        'terra199tvar8v3ayumfrdhtcf2sn7yrg2agf24j8k2x'
      ],
  ANCHOR_TOKEN_ADDRESS: ANCHOR_TOKEN_ADDRESS || 'terra1747mad58h0w4y589y3sk84r5efqdev9q4r02pc',
  SENTRY_DSN,
  USE_LOG_FILE: !!JSON.parse(USE_LOG_FILE || 'false'),
  DISABLE_API: !!JSON.parse(DISABLE_API || 'false'),
  // Keybase for fetching validator avatar image
  KEYBASE_URL_PREFIX: `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=`,
  // Chain parameters
  ACTIVE_DENOMS: ACTIVE_DENOMS ? (JSON.parse(ACTIVE_DENOMS) as string[]) : ['uluna', 'usdr', 'ukrw', 'uusd', 'ueur'],
  ACTIVE_CURRENCY: ACTIVE_CURRENCY
    ? (JSON.parse(ACTIVE_CURRENCY) as string[])
    : ['luna', 'sdr', 'sdt', 'krw', 'krt', 'usd', 'ust', 'eur', 'eut'],
  EXCLUDED_ROUTES: EXCLUDED_ROUTES ? (JSON.parse(EXCLUDED_ROUTES) as string[]).map((regExp) => new RegExp(regExp)) : [],
  MIN_GAS_PRICES: MIN_GAS_PRICES
    ? (JSON.parse(MIN_GAS_PRICES) as DenomMap)
    : ({
        uluna: '0.15',
        uusd: '0.15',
        usdr: '0.1018',
        ukrw: '178.05'
      } as DenomMap),
  PRUNING_KEEP_EVERY: parseInt(PRUNING_KEEP_EVERY || '100', 10) || 100,
  // We can ORACLE_SLASH_WINDOW from {lcd}/oracle/parameters, but do this way because it's rare to be changed
  ORACLE_SLASH_WINDOW: parseInt(ORACLE_SLASH_WINDOW || '100800') || 100800
}

export default config
