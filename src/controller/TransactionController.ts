import { KoaController, Validate, Get, Controller, Validator, Post } from 'koa-joi-controllers'
import { success } from 'lib/response'
import { ErrorCodes } from 'lib/error'
import { getTx, getTxList, getMsgList, postTxs } from 'service/transaction'
import { TERRA_ACCOUNT_REGEX } from 'lib/constant'
import config from 'config'

const Joi = Validator.Joi

@Controller('')
export default class TransactionController extends KoaController {
  /**
   * @api {get} /tx/:txhash Get Tx
   * @apiName getTx
   * @apiGroup Transactions
   *
   * @apiParam {string} txhash Tx Hash
   * @apiSuccess {Object} tx tx info
   * @apiSuccess {Object[]} events events of tx
   * @apiSuccess {Object[]} logs tx logs
   * @apiSuccess {string} height block height
   * @apiSuccess {string} txhash tx hash
   * @apiSuccess {string} raw_log tx raw log
   * @apiSuccess {string} gas_used total gas used in tx
   * @apiSuccess {string} timestamp timestamp tx in utc 0
   * @apiSuccess {string} gas_wanted gas wanted
   */
  @Get('/tx/:txhash')
  @Validate({
    params: {
      txhash: Joi.string().required().alphanum().description('Tx hash')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getTx(ctx): Promise<void> {
    const { txhash } = ctx.params
    success(ctx, await getTx(txhash))
  }

  /**
   * @api {get} /txs Get Tx List
   * @apiName getTxList
   * @apiGroup Transactions
   *
   * @apiParam {string} [account] Account address
   * @apiParam {string} [page=1] Page
   * @apiParam {string} [limit=10] Limit
   * @apiParam {string} [block] Block number
   * @apiParam {string} [memo] Memo filter
   * @apiParam {string} [order] 'asc' or 'desc'
   * @apiParam {string} [chainId=columbus-3] ChainId filter
   * @apiParam {string} [from] timestamp filter (from)
   * @apiParam {string} [to] timestamp ilter (to)
   *
   * @apiSuccess {number} totalCnt total number of txs
   * @apiSuccess {number} page page number of pagination
   * @apiSuccess {number} limt Per page item limit
   * @apiSuccess {Object[]} txs tx list
   * @apiSuccess {Object} txs.tx tx info
   * @apiSuccess {Object[]} txs.events events of tx
   * @apiSuccess {Object[]} txs.logs tx logs
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
      account: Joi.string().allow('').regex(new RegExp(TERRA_ACCOUNT_REGEX)).description('User address'),
      action: Joi.string().allow('').description('Tx types'),
      block: Joi.string().allow('').regex(new RegExp('[0-9]+')),
      order: Joi.string().allow('').valid(['ASC', 'DeSC']).description('Tx order'),
      memo: Joi.string().description('Tx memo'),
      chainId: Joi.string().allow('').valid(config.CHAIN_ID),
      from: Joi.number().description('From timestamp unix time'),
      to: Joi.number().description('To timestamp unix time'),
      page: Joi.number().default(1).min(1).description('Page number'),
      limit: Joi.number().default(10).min(1).description('Items per page')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getTxList(ctx): Promise<void> {
    const { account, action, block, order, memo, chainId } = ctx.request.query
    const page = +ctx.request.query.page
    const limit = +ctx.request.query.limit
    const from = +ctx.request.query.from
    const to = +ctx.request.query.to

    success(
      ctx,
      await getTxList({
        account,
        block,
        action,
        limit,
        page,
        from,
        to,
        order,
        memo,
        chainId
      })
    )
  }
  /**
   * @api {POST} /txs Broadcast Txs
   * @apiName postTxs
   * @apiGroup Transactions
   *
   */
  @Post('/txs')
  @Validate({
    type: 'json',
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async postTxs(ctx): Promise<void> {
    const body = ctx.request.body
    success(ctx, await postTxs(body))
  }

  /**
   * @api {get} /msgs Get Parsed Tx List
   * @apiName getParsedTxList
   * @apiGroup Transactions
   *
   * @apiParam {string} [account] Account address
   * @apiParam {string} [page=1] Page
   * @apiParam {string} [limit=10] Limit
   * @apiParam {string} [action] Action filter
   * @apiParam {string} [order] 'asc' or 'desc'
   * @apiParam {string} [from] Start time (milisecond)
   * @apiParam {string} [to] End time (milisecond)
   *
   * @apiSuccess {number} totalCnt total number of txs
   * @apiSuccess {number} page page number of pagination
   * @apiSuccess {number} limt Per page item limit
   * @apiSuccess {Object[]} txs tx list
   * @apiSuccess {string} txs.timestamp tx time
   * @apiSuccess {string} txs.txhash tx hash
   * @apiSuccess {Object[]} txs.msgs Parsed tx messages
   * @apiSuccess {string} txs.msgs.tag tx tag
   * @apiSuccess {string} txs.msgs.text tx message text format
   * @apiSuccess {Object[]} txs.msgs.in tx input address
   * @apiSuccess {Object[]} txs.msgs.out {denom, amount} format in out
   * @apiSuccess {string} txs.txFee
   * @apiSuccess {string} txs.memo
   * @apiSuccess {boolean} txs.success
   * @apiSuccess {string} txs.errorMessage
   * @apiSuccess {string} txs.chainId
   */
  @Get('/msgs')
  @Validate({
    query: {
      account: Joi.string().regex(new RegExp(TERRA_ACCOUNT_REGEX)).description('User address'),
      action: Joi.string().allow('').description('Tx types'),
      order: Joi.string().allow('').valid(['ASC', 'DeSC']).description('Tx order'),
      from: Joi.number().description('From timestamp unix time'),
      to: Joi.number().description('to timestamp unix time'),
      page: Joi.number().default(1).min(1).description('Page number'),
      limit: Joi.number().default(10).min(1).description('Items per page')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getMsgList(ctx): Promise<void> {
    const { account, action, order } = ctx.request.query
    const page = +ctx.request.query.page
    const limit = +ctx.request.query.limit
    const from = +ctx.request.query.from
    const to = +ctx.request.query.to

    success(
      ctx,
      await getMsgList({
        account,
        action,
        limit,
        page,
        from,
        to,
        order
      })
    )
  }
}
