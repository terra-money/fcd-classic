# Terra FCD

![Banner](banner.png)

## Modules
* ### Collector(Indexer)
  - Takes block and tx from LCD and stores into the database in a usable form
  - Stores issuance, network and staking information to database every minute
  - Collect & cache validator info and store in db
  - Calculate validator daily return
  - Collect & cache proposal info
* ### Rest API server
  * Serves data via RESTFul API

## Prerequisites
1. `Node.js` >= 12
1. `yarn` >= 1.0
1. `PostgreSQL` == 10.x || 11.x

### Terra Core
1. You __must__ use [columbus-3-tracking](https://github.com/terra-project/core/tree/columbus-3-tracking) for calculating taxes. This branch adds TaxCaps, TaxRate event in BeginBlocker
1. `terrad start --tracking` parameter creates the Richlist in the /tmp at the beginning of each day. The more accounts you have, the longer it takes, so you don't have to use them if you don't need it.
1. Setup a LCD
1. Configure firewall ([Reference](https://docs.terra.money/docs/node-production#firewall-configuration)

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
| DISABLE_API         | Disable REST APIs               | false                                        | API                                |
| DISABLE_SOCKET      | Dsiable Web Socket              | false                                        | API                                |
| EXCLUDED_ROUTES     | List of regular expression string for excluding routes | []                    | API                                |


> In Terra we use [direnv](https://direnv.net) for managing environment variable for development. See [sample of .envrc](.envrc_sample)

## Usage
### Developement
* Collector
  ```bash
  yarn run coldev
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
* API
  ```bash
  yarn start
  ```

### Documentation
* apiDoc (https://apidocjs.com)
  - Generate by `yarn run apidoc`
  - Access UI from: `http://localhost:3060/apidoc`
* Swagger 2.0 (https://swagger.io)
  - Generate by `yarn run swagger`
  - Access UI from: `http://localhost:3060/swagger`
  - Access the definition from: `http://localhost:3060/static/swagger.json` 
* Generate swagger for [`AWS`](https://aws.amazon.com/api-gateway/) api gateway
  - ```sh
    yarn run swagger -- --apigateway
    ```
  - Generated file can be directly imported to aws api gateway
  - ```diff 
    - NB : its uses empty schema for response object as api gateway support object and properties name only having alphanum. 
    ```

* Generate combined swagger for lcd and fcd
  - ```sh
    yarn run mergeswagger -- -o filename
    ```
  - Combined swagger file will be saved in `static` directory in project `root`
  - If no filename provided as command line argument then default saved file name is `combined-swagger.json`
  - To generate combined swagger for Amazon api gateway add `--apigateway`
    - Ex: ```
            yarn run mergeswagger -- -o filename --apigateway
          ```

## To run whole ecosystem locally with docker (WIP)
### Requirements
1. docker-ce
2. docker-compose
### Run from project root
```bash
docker-compose up -d --build
```
