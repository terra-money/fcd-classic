import { KoaController, Validate, Get, Controller, Validator } from 'koa-joi-controllers'
import config from 'config'
import { success } from 'lib/response'
import { ErrorCodes } from 'lib/error'
import { TERRA_ACCOUNT_REGEX, CHAIN_ID_REGEX } from 'lib/constant'
import Mempool from 'lib/mempool'
import { getBlock, getTx, getTxList } from 'service/transaction'

const Joi = Validator.Joi

@Controller('')
export default class TransactionController extends KoaController {
  @Get('/blocks/latest')
  async getBlockLatest(ctx): Promise<void> {
    success(ctx, await getBlock(0))
  }

  @Get('/blocks/:height')
  @Validate({
    params: {
      height: Joi.number().required().min(1).description('Block height')
    }
  })
  async getBlock(ctx): Promise<void> {
    success(ctx, await getBlock(ctx.params.height))
  }

  /**
   * @api {get} /tx/:txhash Get Tx
   * @apiName getTx
   * @apiGroup Transactions
   *
   * @apiParam {string} txhash Tx Hash
   *
   * @apiSuccess {Object} tx
   * @apiSuccess {string} tx.type
   * @apiSuccess {Object} tx.value
   * @apiSuccess {Object} tx.value.fee
   * @apiSuccess {Object[]} tx.value.fee.amount
   * @apiSuccess {string} tx.value.fee.amount.denom
   * @apiSuccess {string} tx.value.fee.amount.amount
   * @apiSuccess {string} tx.value.fee.gas
   * @apiSuccess {string} tx.value.memo
   * @apiSuccess {Object[]} tx.value.msg
   * @apiSuccess {string} tx.value.msg.type
   * @apiSuccess {Object} tx.value.msg.value
   * @apiSuccess {Object[]} tx.value.msg.value.amount
   * @apiSuccess {string} tx.value.msg.value.amount.denom
   * @apiSuccess {string} tx.value.msg.value.amount.amount
   * @apiSuccess {Object[]} tx.value.signatures
   * @apiSuccess {Object[]} tx.value.signatures.pubKey
   * @apiSuccess {string} tx.value.signatures.pubKey.type
   * @apiSuccess {string} tx.value.signatures.pubKey.value
   * @apiSuccess {string} tx.value.signatures.signature
   *
   * @apiSuccess {Object[]} events
   * @apiSuccess {Object[]} events
   * @apiSuccess {string} events.type
   * @apiSuccess {Object[]} events.attributes
   * @apiSuccess {string} events.attributes.key
   * @apiSuccess {string} events.attributes.value
   * @apiSuccess {Object[]} logs tx logs
   * @apiSuccess {Object[]} logs.events
   * @apiSuccess {Object[]} logs.events.attributes
   * @apiSuccess {string} logs.events.attributes.key
   * @apiSuccess {string} logs.events.attributes.value
   * @apiSuccess {string} logs.events.types
   * @apiSuccess {Object} logs.log
   * @apiSuccess {string} logs.log.tax
   * @apiSuccess {number} logs.msg_index
   * @apiSuccess {boolean} logs.success
   * @apiSuccess {string} height
   * @apiSuccess {string} txhash
   * @apiSuccess {string} raw_log
   * @apiSuccess {string} gas_used
   * @apiSuccess {string} timestamp
   * @apiSuccess {string} gas_wanted
   * @apiSuccess {string} chainId
   */
  @Get('/tx/:txhash')
  @Validate({
    params: {
      txhash: Joi.string().required().alphanum().description('Tx hash')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getTx(ctx): Promise<void> {
    success(ctx, await getTx(ctx.params.txhash))
  }

  /**
   * @api {get} /txs Get Tx List
   * @apiName getTxList
   * @apiGroup Transactions
   *
   * @apiParam {string} [account] Account address
   * @apiParam {string} [block] Block number
   * @apiParam {string} [chainId] Chain ID of Blockchain (default: chain id of mainnet)
   * @apiParam {number} [offset] Use next property from previous result for pagination
   * @apiParam {number} [limit=10,100] Size of page
   *
   * @apiSuccess {number} limit Size of page
   * @apiSuccess {number} next Offset of next page
   * @apiSuccess {Object[]} txs tx list
   * @apiSuccess {Object} txs.tx
   * @apiSuccess {string} txs.tx.type
   * @apiSuccess {Object} txs.tx.value
   * @apiSuccess {Object} txs.tx.value.fee
   * @apiSuccess {string} txs.tx.value.fee.gas
   * @apiSuccess {Object[]} txs.tx.value.fee.amount
   * @apiSuccess {string} txs.tx.value.fee.amount.denom
   * @apiSuccess {string} txs.tx.value.fee.amount.amount
   * @apiSuccess {string} txs.tx.value.memo
   * @apiSuccess {Object[]} txs.tx.value.msg
   * @apiSuccess {string} txs.tx.value.msg.type
   * @apiSuccess {Object} txs.tx.value.msg.value
   * @apiSuccess {Object[]} txs.tx.value.msg.value.inputs
   * @apiSuccess {string} txs.tx.value.msg.value.inputs.address
   * @apiSuccess {Object[]} txs.tx.value.msg.value.inputs.coins
   * @apiSuccess {string} txs.tx.value.msg.value.inputs.coins.deonm
   * @apiSuccess {string} txs.tx.value.msg.value.inputs.coins.amount
   *
   * @apiSuccess {Object[]} txs.tx.value.msg.value.outputs
   * @apiSuccess {string} txs.tx.value.msg.value.outputs.address
   * @apiSuccess {Object[]} txs.tx.value.msg.value.outputs.coins
   * @apiSuccess {string} txs.tx.value.msg.value.outputs.coins.deonm
   * @apiSuccess {string} txs.tx.value.msg.value.outputs.coins.amount
   *
   *
   * @apiSuccess {Object[]} txs.tx.value.signatures
   * @apiSuccess {string} txs.tx.value.signatures.signature
   * @apiSuccess {Object} txs.tx.value.signatures.pub_key
   * @apiSuccess {string} txs.tx.value.signatures.pub_key.type
   * @apiSuccess {string} txs.tx.value.signatures.pub_key.value
   *
   * @apiSuccess {Object[]} txs.events events of tx
   * @apiSuccess {string} txs.events.type
   * @apiSuccess {Object[]} txs.events.attributes
   * @apiSuccess {string} txs.events.attributes.key
   * @apiSuccess {string} txs.events.attributes.value
   *
   *
   * @apiSuccess {Object[]} txs.logs tx logs
   * @apiSuccess {number} txs.logs.msg_index
   * @apiSuccess {boolean} txs.logs.success
   * @apiSuccess {Object} txs.logs.log
   * @apiSuccess {string} txs.logs.log.tax
   * @apiSuccess {Object[]} txs.logs.events
   * @apiSuccess {string} txs.logs.events.type
   * @apiSuccess {Object[]} txs.logs.events.attributes
   * @apiSuccess {string} txs.logs.events.attributes.key
   * @apiSuccess {string} txs.logs.events.attributes.value
   *
   * @apiSuccess {string} txs.height block height
   * @apiSuccess {string} txs.txhash tx hash
   * @apiSuccess {string} txs.raw_log tx raw log
   * @apiSuccess {string} txs.gas_used total gas used in tx
   * @apiSuccess {string} txs.timestamp timestamp tx in utc 0
   * @apiSuccess {string} txs.gas_wanted gas wanted
   */
  @Get('/txs')
  @Validate({
    query: {
      account: Joi.string().allow('').regex(TERRA_ACCOUNT_REGEX).description('User address'),
      block: Joi.string()
        .allow('')
        .regex(/^\d{1,16}$/),
      chainId: Joi.string().default(config.CHAIN_ID).regex(CHAIN_ID_REGEX),
      limit: Joi.number().default(10).valid(10, 100).description('Items per page'),
      offset: Joi.number().description('Offset'),
      compact: Joi.boolean().description('Compact mode')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getTxList(ctx): Promise<void> {
    success(ctx, await getTxList(ctx.query))
  }

  /**
   * @api {get} /txs/gas_prices Get gas prices
   * @apiName getGasPrices
   * @apiGroup Transactions
   *
   * @apiSuccess {string} uluna gas price in uluna
   * @apiSuccess {string} usdr gas price in usdr
   * @apiSuccess {string} uusd gas price in uusd
   * @apiSuccess {string} ukrw gas price in ukrw
   * @apiSuccess {string} umnt gas price in umnt
   */
  @Get('/txs/gas_prices')
  async getGasPrices(ctx): Promise<void> {
    success(ctx, config.MIN_GAS_PRICES)
  }

  /**
   * @api {get} /mempool/:txhash Get transaction in mempool
   * @apiName getMempoolByHash
   * @apiGroup Transactions
   *
   * @apiSuccess {String} timestamp Last seen
   * @apiSuccess {String} txhash
   * @apiSuccess {Object} tx
   * @apiSuccess {string} tx.type
   * @apiSuccess {Object} tx.value
   * @apiSuccess {Object} tx.value.fee
   * @apiSuccess {Object[]} tx.value.fee.amount
   * @apiSuccess {string} tx.value.fee.amount.denom
   * @apiSuccess {string} tx.value.fee.amount.amount
   * @apiSuccess {string} tx.value.fee.gas
   * @apiSuccess {string} tx.value.memo
   * @apiSuccess {Object[]} tx.value.msg
   * @apiSuccess {string} tx.value.msg.type
   * @apiSuccess {Object} tx.value.msg.value
   * @apiSuccess {Object[]} tx.value.msg.value.amount
   * @apiSuccess {string} tx.value.msg.value.amount.denom
   * @apiSuccess {string} tx.value.msg.value.amount.amount
   * @apiSuccess {Object[]} tx.value.signatures
   * @apiSuccess {Object[]} tx.value.signatures.pubKey
   * @apiSuccess {string} tx.value.signatures.pubKey.type
   * @apiSuccess {string} tx.value.signatures.pubKey.value
   * @apiSuccess {string} tx.value.signatures.signature
   */
  @Get('/mempool/:txhash')
  @Validate({
    params: {
      txhash: Joi.string().required().alphanum().description('Tx hash')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  getMempoolByHash(ctx) {
    success(ctx, Mempool.getTransactionByHash(ctx.params.txhash))
  }

  /**
   * @api {get} /mempool Get transactions in mempool
   * @apiName getMempool
   * @apiGroup Transactions
   *
   * @apiParam {string} [account] Account address
   *
   * @apiSuccess {Object[]} txs
   * @apiSuccess {String} txs.timestamp Last seen
   * @apiSuccess {String} txs.txhash
   * @apiSuccess {Object} txs.tx
   * @apiSuccess {string} txs.tx.type
   * @apiSuccess {Object} txs.tx.value
   * @apiSuccess {Object} txs.tx.value.fee
   * @apiSuccess {string} txs.tx.value.fee.gas
   * @apiSuccess {Object[]} txs.tx.value.fee.amount
   * @apiSuccess {string} txs.tx.value.fee.amount.denom
   * @apiSuccess {string} txs.tx.value.fee.amount.amount
   * @apiSuccess {string} txs.tx.value.memo
   * @apiSuccess {Object[]} txs.tx.value.msg
   * @apiSuccess {string} txs.tx.value.msg.type
   * @apiSuccess {Object} txs.tx.value.msg.value
   * @apiSuccess {Object[]} txs.tx.value.msg.value.inputs
   * @apiSuccess {string} txs.tx.value.msg.value.inputs.address
   * @apiSuccess {Object[]} txs.tx.value.msg.value.inputs.coins
   * @apiSuccess {string} txs.tx.value.msg.value.inputs.coins.deonm
   * @apiSuccess {string} txs.tx.value.msg.value.inputs.coins.amount
   *
   * @apiSuccess {Object[]} txs.tx.value.msg.value.outputs
   * @apiSuccess {string} txs.tx.value.msg.value.outputs.address
   * @apiSuccess {Object[]} txs.tx.value.msg.value.outputs.coins
   * @apiSuccess {string} txs.tx.value.msg.value.outputs.coins.deonm
   * @apiSuccess {string} txs.tx.value.msg.value.outputs.coins.amount
   *
   * @apiSuccess {Object[]} txs.tx.value.signatures
   * @apiSuccess {string} txs.tx.value.signatures.signature
   * @apiSuccess {Object} txs.tx.value.signatures.pub_key
   * @apiSuccess {string} txs.tx.value.signatures.pub_key.type
   * @apiSuccess {string} txs.tx.value.signatures.pub_key.value
   */
  @Get('/mempool')
  @Validate({
    query: {
      account: Joi.string().allow('').regex(TERRA_ACCOUNT_REGEX).description('User address')
    }
  })
  async getMempool(ctx) {
    if (ctx.query.account) {
      success(ctx, {
        txs: Mempool.getTransactionsByAddress(ctx.query.account)
      })
    } else {
      success(ctx, {
        txs: Mempool.getTransactions()
      })
    }
  }
}
