import 'reflect-metadata'
import * as Bluebird from 'bluebird'
import { createConnection, ConnectionOptions, ConnectionOptionsReader, Connection } from 'typeorm'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'
import * as CamelToSnakeNamingStrategy from './CamelToSnakeNamingStrategy'

const debug = require('debug')('orm')

import BlockEntity from './BlockEntity'
export * from './BlockEntity'

import TxEntity from './TxEntity'
export * from './TxEntity'

import PriceEntity from './PriceEntity'
export * from './PriceEntity'

import AccountTxEntity from './AccountTxEntity'
export * from './AccountTxEntity'

import NetworkEntity from './NetworkEntity'
export * from './NetworkEntity'

import RewardEntity from './RewardEntity'
export * from './RewardEntity'

import GeneralInfoEntity from './GeneralInfoEntity'
export * from './GeneralInfoEntity'

import SwapEntity from './SwapEntity'
export * from './SwapEntity'

import DenomEntity from './DenomEntity'
export * from './DenomEntity'

import RichListEntity from './RichListEntity'
export * from './RichListEntity'

import UnvestedEntity from './UnvestedEntity'
export * from './UnvestedEntity'

import BlockRewardEntity from './BlockRewardEntity'
export * from './BlockRewardEntity'

import AccountEntity from './AccountEntity'
export * from './AccountEntity'

import ValidatorReturnInfoEntity from './ValidatorReturnInfoEntity'
export * from './ValidatorReturnInfoEntity'

import ValidatorInfoEntity from './ValidatorInfoEntity'
export * from './ValidatorInfoEntity'

import ProposalEntity from './ProposalEntity'
export * from './ProposalEntity'

import DashboardEntity from './DashboardEntity'
export * from './DashboardEntity'

export {
  BlockEntity,
  TxEntity,
  PriceEntity,
  AccountTxEntity,
  NetworkEntity,
  RewardEntity,
  GeneralInfoEntity,
  SwapEntity,
  DenomEntity,
  RichListEntity,
  UnvestedEntity,
  BlockRewardEntity,
  AccountEntity,
  ValidatorReturnInfoEntity,
  ValidatorInfoEntity,
  ProposalEntity,
  DashboardEntity
}

export const staticOptions = {
  supportBigNumbers: true,
  bigNumberStrings: true,
  entities: [
    BlockEntity,
    TxEntity,
    PriceEntity,
    AccountTxEntity,
    NetworkEntity,
    RewardEntity,
    GeneralInfoEntity,
    SwapEntity,
    DenomEntity,
    RichListEntity,
    UnvestedEntity,
    BlockRewardEntity,
    AccountEntity,
    ValidatorReturnInfoEntity,
    ValidatorInfoEntity,
    ProposalEntity,
    DashboardEntity
  ]
}

function initConnection(options: ConnectionOptions): Promise<Connection> {
  const pgOpts = options as PostgresConnectionOptions
  debug(`creating connection ${pgOpts.name || 'default'} to ${pgOpts.username}@${pgOpts.host}:${pgOpts.port || 5432}`)

  return createConnection({
    ...options,
    ...staticOptions,
    namingStrategy: new CamelToSnakeNamingStrategy()
  })
}

export async function init(): Promise<Connection[]> {
  const reader = new ConnectionOptionsReader()
  const options = await reader.all()

  if (options.length && !options.filter((o) => o.name === 'default').length) {
    options[0]['name' as any] = 'default'
  }

  return Bluebird.map(options, initConnection)
}
