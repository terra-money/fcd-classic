import { KoaController, Validate, Get, Controller, Validator } from 'koa-joi-controllers'

import { success } from 'lib/response'
import { ErrorCodes } from 'lib/error'
import { TERRA_ACCOUNT_REGEX } from 'lib/constant'

import { getWasmCodes, getContracts, getContractTxs } from 'service/wasm'

const Joi = Validator.Joi

@Controller('/wasm')
export default class WasmController extends KoaController {
  /**
   * @api {get} /wasm/codes Get wasm codes info
   * @apiName getWasmCode
   * @apiGroup Wasm
   *
   * @apiParam {string} [sender] wasm code sender Account address
   * @apiParam {string} [page=1] Page
   * @apiParam {string} [limit=10] Limit
   *
   * @apiSuccess {number} totalCnt total number of txs
   * @apiSuccess {number} page page number of pagination
   * @apiSuccess {number} limit Per page item limit
   * @apiSuccess {Object[]} codes wasm code info list
   * @apiSuccess {string} codes.txhash
   * @apiSuccess {string} codes.timestamp
   * @apiSuccess {string} codes.sender
   * @apiSuccess {string} codes.code_id sent code id
   **/
  @Get('/codes')
  @Validate({
    query: {
      sender: Joi.string().regex(TERRA_ACCOUNT_REGEX).description('WASM code sender'),
      page: Joi.number().default(1).min(1).description('Page number'),
      limit: Joi.number().default(10).min(1).description('Items per page')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async wasmCodes(ctx) {
    const { sender, page, limit } = ctx.query

    success(ctx, await getWasmCodes(page, limit, sender))
  }
  /**
   * @api {get} /wasm/contracts Get wasm codes info
   * @apiName getWasmContract
   * @apiGroup Wasm
   *
   * @apiParam {string} [owner] contract owner Account address
   * @apiParam {string} [page=1] Page
   * @apiParam {string} [limit=10] Limit
   *
   * @apiSuccess {number} totalCnt total number of txs
   * @apiSuccess {number} page page number of pagination
   * @apiSuccess {number} limit Per page item limit
   * @apiSuccess {Object[]} contracts contracts info
   * @apiSuccess {string} contracts.txhash
   * @apiSuccess {string} contracts.timestamp
   * @apiSuccess {string} contracts.owner
   * @apiSuccess {string} contracts.code_id sent code id
   * @apiSuccess {string} contracts.contract_address contract address
   **/
  @Get('/contracts')
  @Validate({
    query: {
      owner: Joi.string().regex(TERRA_ACCOUNT_REGEX).description('contract owner'),
      page: Joi.number().default(1).min(1).description('Page number'),
      limit: Joi.number().default(10).min(1).description('Items per page')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async wasmContracts(ctx) {
    const { owner, page, limit } = ctx.query
    success(ctx, await getContracts(page, limit, owner))
  }
  /**
   * @api {get} /wasm/contract/:contract_address/txs Get wasm codes info
   * @apiName getWasmContractTxs
   * @apiGroup Wasm
   *
   * @apiParam {string} contract_address contract address
   * @apiParam {string} [sender] contract execution sender Account address
   * @apiParam {string} [page=1] Page
   * @apiParam {string} [limit=10] Limit
   *
   * @apiSuccess {number} totalCnt total number of txs
   * @apiSuccess {number} page page number of pagination
   * @apiSuccess {number} limit Per page item limit
   * @apiSuccess {Object[]} txs tx list
   * @apiSuccess {Object} txs.tx tx info
   * @apiSuccess {string} txs.tx.type Tx type
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
   **/
  @Get('/contract/:contract_address/txs')
  @Validate({
    query: {
      sender: Joi.string().regex(TERRA_ACCOUNT_REGEX).description('tx sender'),
      page: Joi.number().default(1).min(1).description('Page number'),
      limit: Joi.number().default(10).min(1).description('Items per page')
    },
    params: {
      contract_address: Joi.string().regex(TERRA_ACCOUNT_REGEX).description('Contract address')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async contractTxs(ctx) {
    const { sender, page, limit } = ctx.query
    const { contract_address } = ctx.params
    success(ctx, await getContractTxs({ page, limit, contract_address, sender }))
  }
}
