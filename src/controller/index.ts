import DashboardController from './DashboardController'
import BankController from './BankController'
import TransactionController from './TransactionController'
import MarketController from './MarketController'
import StakingController from './StakingController'
import GovernanceController from './GovernanceController'
import TreasuryController from './TreasuryController'
import WasmController from './WasmController'

const controllers = [
  new BankController(),
  new DashboardController(),
  new GovernanceController(),
  new MarketController(),
  new StakingController(),
  new TransactionController(),
  new TreasuryController(),
  new WasmController()
]
export default controllers
