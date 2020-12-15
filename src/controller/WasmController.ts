import { KoaController, Validate, Get, Controller, Validator } from 'koa-joi-controllers'

import { success } from 'lib/response'
import { ErrorCodes } from 'lib/error'
import { TERRA_ACCOUNT_REGEX } from 'lib/constant'

import { getWasmCodes, getWasmContracts, getContractTxs, getWasmCode, getWasmContract } from 'service/wasm'

const Joi = Validator.Joi

@Controller('/wasm')
export default class WasmController extends KoaController {
  /**
   * @api {get} /wasm/codes Get wasm codes info
   * @apiName getWasmCodeList
   * @apiGroup Wasm
   *
   * @apiParam {string} [sender] wasm code sender Account address
   * @apiParam {string} [page=1] Page
   * @apiParam {string} [limit=10] Limit
   * @apiParam {string} [search] full text search query in name and description
   *
   * @apiSuccess {number} totalCnt total number of txs
   * @apiSuccess {number} page page number of pagination
   * @apiSuccess {number} limit Per page item limit
   * @apiSuccess {Object[]} codes wasm code info list
   * @apiSuccess {string} codes.txhash
   * @apiSuccess {string} codes.timestamp
   * @apiSuccess {string} codes.sender
   * @apiSuccess {string} codes.code_id sent code id
   * @apiSuccess {Object} codes.info code info
   * @apiSuccess {string} codes.info.name code name
   * @apiSuccess {string} codes.info.description description
   * @apiSuccess {string} codes.info.repo_url code repo url
   * @apiSuccess {string} codes.info.memo tx memo
   *
   **/
  @Get('/codes')
  @Validate({
    query: {
      sender: Joi.string().regex(TERRA_ACCOUNT_REGEX).description('WASM code sender'),
      search: Joi.string().description('full text search query'),
      page: Joi.number().default(1).min(1).description('Page number'),
      limit: Joi.number().default(10).min(1).description('Items per page')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async wasmCodes(ctx) {
    success(ctx, await getWasmCodes(ctx.query))
  }
  /**
   * @api {get} /wasm/contracts Get wasm codes info
   * @apiName getWasmContractList
   * @apiGroup Wasm
   *
   * @apiParam {string} [owner] contract owner Account address
   * @apiParam {string} [page=1] Page
   * @apiParam {string} [limit=10] Limit
   * @apiParam {string} [search] full text search query in name and description
   * @apiParam {number} [codeId] code id
   *
   * @apiSuccess {number} totalCnt total number of txs
   * @apiSuccess {number} page page number of pagination
   * @apiSuccess {number} limit Per page item limit
   * @apiSuccess {Object[]} contracts contracts info
   * @apiSuccess {string} contracts.txhash
   * @apiSuccess {string} contracts.timestamp
   * @apiSuccess {string} contracts.owner
   * @apiSuccess {string} contracts.code_id sent code id
   * @apiSuccess {string} contracts.contractAddress contract address
   * @apiSuccess {string} contracts.init_msg contract initialization message
   * @apiSuccess {Object} contracts.info code info
   * @apiSuccess {string} contracts.info.name code name
   * @apiSuccess {string} contracts.info.description description
   * @apiSuccess {string} contracts.info.memo tx memo
   * @apiSuccess {boolean} contracts.migratable contract migratable
   * @apiSuccess {string} contracts.migrate_msg contract migrate message
   * @apiSuccess {Object} contracts.code code details info
   * @apiSuccess {string} contracts.code.txhash
   * @apiSuccess {string} contracts.code.timestamp
   * @apiSuccess {string} contracts.code.sender
   * @apiSuccess {string} contracts.code.code_id sent code id
   * @apiSuccess {Object} contracts.code.info code info
   * @apiSuccess {string} contracts.code.info.name code name
   * @apiSuccess {string} contracts.code.info.description description
   * @apiSuccess {string} contracts.code.info.repo_url code repo url
   * @apiSuccess {string} contracts.code.info.memo tx memo
   **/
  @Get('/contracts')
  @Validate({
    query: {
      owner: Joi.string().regex(TERRA_ACCOUNT_REGEX).description('contract owner'),
      search: Joi.string().description('full text search query'),
      codeId: Joi.string().regex(/^\d+$/).description('Code id'),
      page: Joi.number().default(1).min(1).description('Page number'),
      limit: Joi.number().default(10).min(1).description('Items per page')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async wasmContracts(ctx) {
    success(ctx, await getWasmContracts(ctx.query))
  }
  /**
   * @api {get} /wasm/contract/:contractAddress/txs Get wasm codes info
   * @apiName getWasmContractTxs
   * @apiGroup Wasm
   *
   * @apiParam {string} contractAddress contract address
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
   * @apiSuccess {string} txs.tx.value.msg.value.inputs.coins.denom
   * @apiSuccess {string} txs.tx.value.msg.value.inputs.coins.amount
   *
   * @apiSuccess {Object[]} txs.tx.value.msg.value.outputs
   * @apiSuccess {string} txs.tx.value.msg.value.outputs.address
   * @apiSuccess {Object[]} txs.tx.value.msg.value.outputs.coins
   * @apiSuccess {string} txs.tx.value.msg.value.outputs.coins.denom
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
  @Get('/contract/:contractAddress/txs')
  @Validate({
    query: {
      sender: Joi.string().regex(TERRA_ACCOUNT_REGEX).description('tx sender'),
      page: Joi.number().default(1).min(1).description('Page number'),
      limit: Joi.number().default(10).min(1).description('Items per page')
    },
    params: {
      contractAddress: Joi.string().regex(TERRA_ACCOUNT_REGEX).description('Contract address')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async contractTxs(ctx) {
    success(ctx, await getContractTxs({ ...ctx.query, ...ctx.params }))
  }

  /**
   * @api {get} /wasm/code/:code_id Get single wasm code details
   * @apiName getIndividualWasmCode
   * @apiGroup Wasm
   *
   * @apiParam {string} code_id wasm code id
   *
   * @apiSuccess {string} txhash
   * @apiSuccess {string} timestamp
   * @apiSuccess {string} sender
   * @apiSuccess {string} code_id sent code id
   * @apiSuccess {Object} info code info
   * @apiSuccess {string} info.name code name
   * @apiSuccess {string} info.description description
   * @apiSuccess {string} info.repo_url code repo url
   * @apiSuccess {string} info.memo tx memo
   **/
  @Get('/code/:codeId')
  @Validate({
    params: {
      codeId: Joi.string().regex(/^\d+$/).required().description('Code id')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getIndividualCode(ctx) {
    success(ctx, await getWasmCode(ctx.params.code_id))
  }

  /**
   * @api {get} /wasm/contract/:contractAddress Get single wasm contract details
   * @apiName getIndividualWasmContract
   * @apiGroup Wasm
   *
   * @apiParam {string} contractAddress wasm contract address
   *
   * @apiSuccess {string} txhash
   * @apiSuccess {string} timestamp
   * @apiSuccess {string} owner
   * @apiSuccess {string} code_id sent code id
   * @apiSuccess {string} contractAddress contract address
   * @apiSuccess {string} init_msg contract initialization message
   * @apiSuccess {Object} info code info
   * @apiSuccess {string} info.name code name
   * @apiSuccess {string} info.description description
   * @apiSuccess {string} info.memo tx memo
   * @apiSuccess {boolean} migratable contract migratable
   * @apiSuccess {string} migrate_msg contract migrate message
   * @apiSuccess {Object} code code details info
   * @apiSuccess {string} code.txhash
   * @apiSuccess {string} code.timestamp
   * @apiSuccess {string} code.sender
   * @apiSuccess {string} code.code_id sent code id
   * @apiSuccess {Object} code.info code info
   * @apiSuccess {string} code.info.name code name
   * @apiSuccess {string} code.info.description description
   * @apiSuccess {string} code.info.repo_url code repo url
   * @apiSuccess {string} code.info.memo tx memo
   **/
  @Get('/contract/:contractAddress')
  @Validate({
    params: {
      contractAddress: Joi.string().regex(TERRA_ACCOUNT_REGEX).required().description('Contract address')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getIndividualContract(ctx) {
    success(ctx, await getWasmContract(ctx.params.contractAddress))
  }
}
