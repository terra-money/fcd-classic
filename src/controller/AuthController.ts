import { KoaController, Validate, Get, Controller, Validator } from 'koa-joi-controllers'

import { success } from 'lib/response'
import { ErrorCodes } from 'lib/error'
import { TERRA_ACCOUNT_REGEX } from 'lib/constant'

import { getAccount } from 'service/auth'

const Joi = Validator.Joi

@Controller(`/auth`)
export default class AuthController extends KoaController {
  /**
   * @api {get} /bank/:account Get account information
   * @apiName getAccount
   * @apiGroup Auth
   *
   * @apiParam {string} account Account address in bech32 format
   *
   * @apiSuccess {string} address
   * @apiSuccess {string} public_key.type
   * @apiSuccess {string} public_key.value
   * @apiSuccess {string} account_number
   * @apiSuccess {string} sequence
   */
  @Get('/accounts/:account')
  @Validate({
    params: {
      account: Joi.string().regex(TERRA_ACCOUNT_REGEX)
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getAccount(ctx) {
    success(ctx, await getAccount(ctx.params.account))
  }
}
