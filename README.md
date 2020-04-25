# Terra FCD 

## Modules
* ### Collector(Indexer)
  - Takes block and tx from LCD and stores into the database in a usable form
  - Stores issuance, network and staking information to database every minute
* ### Validator Scrapper
  - Collect validator info and store in db
  - Calculate validaor daily return
* ### Rest API server
  * Serves data via RESTFul API

## Prerequisites
1. `Node.js` >= 12
1. `yarn` >= 1.0
1. `PostgreSQL` == 10.x || 11.x

### Terra Core
1. Use [columbus-3-tracking](https://github.com/terra-project/core/tree/columbus-3-tracking) branch
1. `terrad start --tracking` creates the Richlist in the /tmp at the beginning of each day. The more accounts you have, the longer it takes, so you don't have to use them if you don't need them.
1. Setup a LCD
1. Configure firewall ([Reference](https://docs.terra.money/docs/node-production#firewall-configuration))

## Project setup

### 1. Clone
```bash
$ git clone https://github.com/terra-project/fcd.git
```

### 2. Install packages
```bash
yarn
```

### 3. Setup Database
FCD requires PostgreSQL as a backend database and [TypeORM](https://github.com/typeorm/typeorm) as an ORM.

#### Create a new database for FCD
```psql
postgres=> CREATE DATABASED fcd OWNER terra;
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
| Name                | Description                     | Default                                      | Module(s)                          |
|---------------------|---------------------------------|----------------------------------------------|------------------------------------|
| SERVER_PORT         | Listening port for API server   | 3060                                         | API                                |
| SENTRY_DSN          | Sentry DSN for error management |                                              | All                                |
| CHAIN_ID            | Chain ID of Terra network       | soju-0014                                    | API, Collector                     |
| LCD_URI             | LCD URI for Terra network       | https://soju-lcd.terra.dev                   | API, Collector, Validator Scrapper |
| FCD_URI             | FCD URI for Terra network       | https://soju-fcd.terra.dev                   | Collector                          |
| RPC_URI             | RPC URI for Terra network       | <required>                                   | Collector                          |
| BYPASS_URI          | Terra LCD address               | https://soju-lcd.terra.dev                   | API                                |
| STATION_STATUS_JSON | URL for Station version control | https://terra.money/station/version-web.json | API                                |
| USE_LOG_FILE        | Creates logs/* when enabled     | false                                        | All                                |
| SC_AUTH_KEY         | Authentication key for SocketCluster | <required>                              | API                                |
| HEIGHT_REPORT_INTERVAL | Interval for SC height notification | 5000                                  | API                                |
| TAX_CAP_TARGETS     | Cap of Tax                      | ["usdr"]                                     | API                                |
| ACTIVE_DENOMS       | Active Denominations            | ["uluna","usdr","ukrw","uusd","umnt"]        | API                                |
| ACTIVE_CURRENCY     | Active Currencies               | ["luna","sdt","krt","ust","mnt"]             | API                                |

> In Terra we use [direnv](https://direnv.net) for managing environment variable for development. See [sample of .envrc](.envrc_sample)

## Usage
### Developement
* Collector
  ```bash
  yarn run coldev
  ```
* Validator scrapper
  ```bash
  yarn run vscoldev
  ```
* API
  ```bash
  yarn run dev
  ```
* Test
  ```bash
  yarn run test
  ```
  * Tests are designed to use soju network

### Production
* Collector
  ```bash
  yarn run collector
  ```
* Validator scrapper
  ```bash
  yarn run vscolprod
  ```
* API
  ```bash
  yarn start
  ```

## To run whole ecosystem locally with docker (WIP)
### Requirements
1. docker-ce
2. docker-compose
### Run from project root
```bash
docker-compose up -d --build
```
