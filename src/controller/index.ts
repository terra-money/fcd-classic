import { compact } from 'lodash'

import DashboardController from './DashboardController'
import BankController from './BankController'
import TransactionController from './TransactionController'
import MarketController from './MarketController'
import StakingController from './StakingController'
import GovernanceController from './GovernanceController'
import TreasuryController from './TreasuryController'

const controllers = compact([
  BankController,
  DashboardController,
  GovernanceController,
  MarketController,
  StakingController,
  TransactionController,
  TreasuryController
])

export default controllers
