import { KoaController, Validate, Get, Controller, Validator } from 'koa-joi-controllers'

import { success } from 'lib/response'
import { ErrorCodes } from 'lib/error'
import { TERRA_ACCOUNT_REGEX } from 'lib/constant'
import * as lcd from 'lib/lcd'

import { getWasmContracts, getWasmCode, getWasmContract } from 'service/wasm'

const Joi = Validator.Joi

@Controller('/wasm')
export default class WasmController extends KoaController {
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
      // search: Joi.string().description('full text search query'),
      // codeId: Joi.string().regex(/^\d+$/).description('Code id'),
      limit: Joi.number().default(10).valid(10).description('Items per page'),
      offset: Joi.alternatives(Joi.number(), Joi.string()).description('Offset')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async wasmContracts(ctx) {
    success(ctx, await getWasmContracts(ctx.query))
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
    success(ctx, await getWasmCode(ctx.params.codeId))
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
    // success(ctx, await getWasmContract(ctx.params.contractAddress))
    success(ctx, await lcd.getContract(ctx.params.contractAddress))
  }
}
