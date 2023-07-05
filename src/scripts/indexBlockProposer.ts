import * as Bluebird from 'bluebird'
import { getManager } from 'typeorm'
import { chunk } from 'lodash'
import { init, BlockEntity } from 'orm'
import * as token from 'service/token'
import { getValidatorOperatorAddressByConsensusAddress } from 'collector/block'
import config from 'config'
import * as lcd from 'lib/lcd'

/**
 * For building columns of BlockEntity
 */
async function main() {
  const conns = await init()
  await token.init()

  const latestHeight = +(
    await getManager().findOneOrFail(
      BlockEntity,
      {
        chainId: config.CHAIN_ID
      },
      { order: { height: 'DESC' } }
    )
  ).height

  console.log(`Total ${latestHeight - +config.INITIAL_HEIGHT} heights`)
  const heights = Array.from(Array(latestHeight + 1).keys())
    .slice(1)
    .map((n) => n + config.INITIAL_HEIGHT - 1)

  // do 1,000 updates at a time
  await Bluebird.mapSeries(chunk(heights, 1000), async (chk) => {
    const lcdDatas = await Bluebird.map(chk, async (height) => lcd.getBlock(height.toString()), { concurrency: 16 })
    console.log(`height ${chk[0]}`)

    await getManager().transaction(async (mgr) => {
      const blocks = await mgr
        .createQueryBuilder(BlockEntity, 'block')
        .where(`chain_id='${config.CHAIN_ID}' AND block.height IN(:...chk)`, { chk })
        .orderBy('block.height')
        .getMany()

      if (lcdDatas.length !== blocks.length) {
        throw new Error(`data mismatch. len(lcdDatas) ${lcdDatas.length} != lens(blocks) ${blocks.length}`)
      }

      await Bluebird.map(
        blocks,
        async (b, idx) => {
          const l = lcdDatas[idx]

          if (+l.block.header.height !== b.height) {
            throw new Error('height mismatch')
          }

          // const hash = l.block_id ? l.block_id.hash : l.block_meta.block_id.hash,
          // const parentHash = l.block.header.last_block_id.hash,
          const addr = l.block.header.proposer_address

          const proposer = await getValidatorOperatorAddressByConsensusAddress(addr, b.height.toString()).catch(
            (err) => {
              console.log(`error: ${err.message}, height: ${b.height}`)
              // return getValidatorOperatorAddressByHexAddress(addr, b.height)
              throw err
            }
          )

          return mgr.update(BlockEntity, b.id, { proposer })
        },
        { concurrency: 16 }
      )
    })
  })

  await Promise.all(conns.map((c) => c.close()))
}

main().catch(console.error)
