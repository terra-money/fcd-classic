# Terra FCD

![Banner](banner.png)

## Modules

- ### Collector(Indexer)
  - Takes block and tx from [LCD](https://docs.terra.money/How-to/Start-LCD.html#start-the-light-client-daemon-lcd) and stores into the database in a usable form
  - Stores issuance, network and staking information to database every minute
  - Collect & cache validator info and store in db
  - Calculate validator daily return
  - Collect & cache proposal info
- ### Rest API server
  - Serves data via RESTFul API

## Prerequisites

1. `Node.js` v16.x or later
1. `PostgreSQL` v12.x or later

## Project setup

### 1. Clone

```bash
$ git clone https://github.com/terra-money/fcd.git
```

### 2. Install packages

```bash
npm i
```

### 3. Setup the database

FCD requires PostgreSQL as a backend database and [TypeORM](https://github.com/typeorm/typeorm) as an ORM.

#### Create a new database for FCD

```psql
postgres=> CREATE DATABASE fcd OWNER terra;
```

#### Synchronize Database Scheme

Table schema has to be synced before running Collector by setting `synchronize` to `true`. There is many way to configure TypeORM. Example is below:

**ormconfig.js**

```javascript
module.exports = {
  name: 'default',
  type: 'postgres',
  host: 'localhost',
  database: 'fcd',
  username: 'terra',
  password: '<password>',
  synchronize: true
}
```

> You shall not use CLI method, and it is good to disable synchronize option after the first sync.

### 4. Configure Environment Variables

| Name                | Description                                                    | Default                                                                                | Module(s)      |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------- |
| CHAIN_ID            | Chain ID of Terra network                                      | bombay-12                                                                              | API, Collector |
| INITIAL_HEIGHT      | The initial height of network. (Define 4724001 for Columbus-5) |                                                                                        | Collector      |
| LCD_URI             | LCD URI for Terra network                                      | https://bombay-lcd.terra.dev                                                           | API, Collector |
| RPC_URI             | RPC URI for Terra network                                      | _required:_ http://x.x.x.x:26657                                                       | API, Collector |
| USE_LOG_FILE        | Write logs to logs directory                                   | false                                                                                  | API, Collector |
| SENTRY_DSN          | Sentry DSN for error management (optional)                     |                                                                                        | API, Collector |
| SERVER_PORT         | Listening port for API server                                  | 3060                                                                                   | API            |
| FCD_URI             | FCD URI for Terra network                                      | https://bombay-fcd.terra.dev                                                           | API            |
| BYPASS_URI          | Terra LCD address                                              | https://bombay-lcd.terra.dev                                                           | API            |
| MIRROR_GRAPH_URI    | Mirror GraphQL endpoint                                        | https://bombay-graph.mirror.finance/graphql                                            | API            |
| PYLON_API_ENDPOINT  | Pylon API endpoint                                             | https://api.dev.pylon.rocks/api                                                        | API            |
| STATION_STATUS_JSON | URL for Station version control                                | https://terra.money/station/version-web.json                                           | API            |
| ACTIVE_DENOMS       | Active Denominations                                           | ["uluna","usdr","ukrw","uusd","umnt"]                                                  | API            |
| ACTIVE_CURRENCY     | Active Currencies                                              | ["luna","sdt","krt","ust","mnt"]                                                       | API            |
| DISABLE_API         | Disable REST APIs                                              | false                                                                                  | API            |
| EXCLUDED_ROUTES     | List of regular expression string for excluding routes         | []                                                                                     | API            |
| MIN_GAS_PRICES      | Minimum gas price by denom object                              | {"uluna": "0.015", "usdr": "0.015", "uusd": "0.015", "ukrw": "0.015", "umnt": "0.015"} | API            |
| PRUNING_KEEP_EVERY  | Pruning option of RPC node configuration                       | 100                                                                                    | Collector      |
| PRUNING_KEEP_RECENT | Pruning option of RPC node configuration                       | 362880                                                                                 | Collector      |
| TOKEN_NETWORK       | Network specifier for whitelisted tokens                       | _required:_ mainnet / testnet                                                          | API            |

> In Terra, we use [direnv](https://direnv.net) for managing environment variable for development. See [sample of .envrc](.envrc_sample)

## Running modules

### Developement

- Collector
  ```bash
  npm run coldev
  ```
- API
  ```bash
  npm run dev
  ```
- Test
  ```bash
  npm run test
  ```
  - Tests are designed to use testnet

### Production

- Collector
  ```bash
  npm run collector
  ```
- API
  ```bash
  npm run start
  ```

## APIDoc & Swagger

### apiDoc (https://apidocjs.com)

- Generate by `npm run apidoc`
- Access UI from: `http://localhost:3060/apidoc`

### Swagger 2.0 (https://swagger.io)

- Generate by `npm run swagger`
- Access UI from: `http://localhost:3060/swagger`
- Access the definition from: `http://localhost:3060/static/swagger.json`

### Generate swagger for [`AWS`](https://aws.amazon.com/api-gateway/) api gateway

```sh
npm run swagger -- --apigateway
```

- Generated file can be directly imported to aws api gateway
- NB : its uses empty schema for response object as api gateway support object and properties name only having alphanum.

### Generate combined swagger for lcd and fcd

```sh
npm run mergeswagger -- -o filename
```

- Combined swagger file will be saved in `static` directory in project `root`
- If no filename provided as command line argument then default saved file name is `combined-swagger.json`
- To generate combined swagger for AWS API Gateway add `--apigateway` parameter

## Find LocalTerra to run whole ecosystem locally

https://github.com/terra-money/localterra
