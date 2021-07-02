const {
  SERVER_PORT,
  CHAIN_ID,
  LCD_URI,
  FCD_URI,
  RPC_URI,
  BYPASS_URI,
  MIRROR_GRAPH_URI,
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
  PYLON_API_ENDPOINT,
  LEGACY_NETWORK,
  ORACLE_SLASH_WINDOW
} = process.env

const config = {
  ORM: 'default',
  PORT: SERVER_PORT ? +SERVER_PORT : 3060,
  CHAIN_ID: CHAIN_ID || 'tequila-0004',
  LCD_URI: LCD_URI || 'https://tequila-lcd.terra.dev',
  FCD_URI: FCD_URI || 'https://tequila-fcd.terra.dev',
  RPC_URI: RPC_URI || 'http://localhost:26657',
  BYPASS_URI: BYPASS_URI || 'https://tequila-lcd.terra.dev',
  MIRROR_GRAPH_URI: MIRROR_GRAPH_URI || 'https://tequila-graph.mirror.finance/graphql',
  PYLON_API_ENDPOINT: PYLON_API_ENDPOINT || 'https://api.dev.pylon.rocks/api',
  STATION_STATUS_JSON_URL: STATION_STATUS_JSON || 'https://terra.money/station/version-web.json',
  BANK_WALLETS: BANK_WALLETS ? (JSON.parse(BANK_WALLETS) as string[]) : [],
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
  EXCLUDED_ROUTES: EXCLUDED_ROUTES
    ? (JSON.parse(EXCLUDED_ROUTES) as string[]).map((regExp) => new RegExp(regExp))
    : [
        /* /\/wasm\// */
      ],
  MIN_GAS_PRICES: MIN_GAS_PRICES
    ? (JSON.parse(MIN_GAS_PRICES) as CoinByDenoms)
    : ({
        uluna: '0.15',
        uusd: '0.15',
        usdr: '0.1018',
        ukrw: '178.05'
      } as CoinByDenoms),
  PRUNING_KEEP_EVERY: parseInt(PRUNING_KEEP_EVERY || '100', 10) || 100,
  LEGACY_NETWORK: !!JSON.parse(LEGACY_NETWORK || 'true'),
  // We can ORACLE_SLASH_WINDOW from {lcd}/oracle/parameters, but do this way because it's rare to be changed
  ORACLE_SLASH_WINDOW: parseInt(ORACLE_SLASH_WINDOW || '100800') || 100800
}

export default config
