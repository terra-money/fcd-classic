import * as Bluebird from 'bluebird'
import BigNumber from 'bignumber.js'
import { getManager } from 'typeorm'
import { init, DashboardEntity } from 'orm'
import { startOfDay } from 'date-fns'
import * as lcd from 'lib/lcd'
import { init as initToken, getToken } from 'service/treasury/token'

const MIR_AT_SNAPSHOT = '9150000000000'
// const SNAPSHOT_HEIGHT = 680000
const SNAPSHOT_DIST_AT = 825000
const DIST_STARTED_AT = 920000
// Tequila
// const SNAPSHOT_HEIGHT = 1350000
// const SNAPSHOT_DIST_AT = 1375000
// const DIST_STARTED_AT = 1380000
const MIR_EVERY_100K = '345283000000'
const DIST_INTERVAL = 100000
const DIST_END_AT = DIST_STARTED_AT + DIST_INTERVAL * 53

/**
 * Returns MIR token airdrop in Luna unit at given height
 * @param height target height for calculation
 */
async function calculateAirdropAtHeight(
  height: string
): Promise<{
  height: string
  timestamp: Date
  airdrop: string
}> {
  if (+height < SNAPSHOT_DIST_AT || +height > DIST_END_AT) {
    throw new Error('height out of range')
  }

  const lcdBlock = await lcd.getBlock(height)
  const prices = await lcd.getOraclePrices(height)
  const lunaPriceInUST = prices.find((c) => c.denom === 'uusd')?.amount

  if (!lunaPriceInUST) {
    throw new Error(`cannot find uusd price at the height ${height}`)
  }

  const mirAmount = +height === SNAPSHOT_DIST_AT ? MIR_AT_SNAPSHOT : MIR_EVERY_100K

  const { assets } = (await lcd.getContractStore(getToken('mir').pair, { pool: {} }, height)) as any
  const [{ amount: uusdAmount }, { amount: assetAmount }] = assets
  const mirPriceInUST = new BigNumber(uusdAmount).div(assetAmount)
  const airdrop = mirPriceInUST.dividedBy(lunaPriceInUST).multipliedBy(mirAmount).toFixed(0)

  console.log('mir price', mirPriceInUST.toString(), 'ust price', lunaPriceInUST, 'airdrop', airdrop)

  return {
    height,
    timestamp: new Date(lcdBlock.block.header.time),
    airdrop
  }
}

async function getAirdrops() {
  const airdrops = [await calculateAirdropAtHeight(SNAPSHOT_DIST_AT.toString())]
  const latestBlock = await lcd.getLatestBlock()

  for (let height = DIST_STARTED_AT; height < +latestBlock.block.header.height; height += DIST_INTERVAL) {
    airdrops.push(await calculateAirdropAtHeight(height.toString()))
  }

  return airdrops
}

async function main() {
  const conns = await init()
  await initToken()

  const rawAirdrops = await getAirdrops()

  await getManager().transaction((mgr) =>
    Bluebird.mapSeries(rawAirdrops, async (rawAirdrop) => {
      const dashboard = await mgr.findOneOrFail(DashboardEntity, {
        timestamp: startOfDay(rawAirdrop.timestamp)
      })

      dashboard.airdrop = rawAirdrop.airdrop
      console.log(`setting airdrop ${dashboard.airdrop} for ${dashboard.timestamp}`)
      return mgr.update(DashboardEntity, { id: dashboard.id }, dashboard)
    })
  )

  await Promise.all(conns.map((c) => c.close()))
}

main().catch(console.error)
