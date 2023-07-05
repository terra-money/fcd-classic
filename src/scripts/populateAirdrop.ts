import * as Bluebird from 'bluebird'
import BigNumber from 'bignumber.js'
import { getManager } from 'typeorm'
import { init, DashboardEntity } from 'orm'
import { startOfDay } from 'date-fns'
import * as lcd from 'lib/lcd'
import { plus } from 'lib/math'
import { init as initToken, getToken } from 'service/token'
import config from 'config'

const DIST_INTERVAL = 100000

const MIR_AT_SNAPSHOT = '9150000000000'
const MIR_AT_INTERVAL = '345283000000'
// const SNAPSHOT_HEIGHT = 680000
const MIR_INITIAL_HEIGHT = 825000
const MIR_START_HEIGHT = 920000
// Tequila
// const SNAPSHOT_HEIGHT = 1350000
// const SNAPSHOT_DIST_AT = 1375000
// const DIST_STARTED_AT = 1380000
const MIR_END_HEIGHT = MIR_START_HEIGHT + DIST_INTERVAL * 53

const ANC_AT_SNAPSHOT = '50000000000000'
const ANC_AT_INTERVAL = '961538461538'
const ANC_INITIAL_HEIGHT = 2211000
const ANC_START_HEIGHT = 2279600
const ANC_END_HEIGHT = ANC_START_HEIGHT + DIST_INTERVAL * 104

const MINE_AT_SNAPSHOT = '500000000000000'
const MINE_AT_INTERVAL = '10416666666666'
const MINE_INITIAL_HEIGHT = 3508600
const MINE_START_HEIGHT = 3608300
const MINE_END_HEIGHT = MINE_START_HEIGHT + DIST_INTERVAL * 104

interface Airdrop {
  height: string
  timestamp: Date
  airdrop: string
}

/**
 * Returns MIR token airdrop in Luna unit at given height
 * @param height target height for calculation
 */
async function calculateAirdropAtHeight(
  token: string,
  amount: string,
  height: string,
  skipOld = true
): Promise<Airdrop | undefined> {
  if (+height < config.INITIAL_HEIGHT) {
    return
  }

  const lcdBlock = await lcd.getBlock(height)
  const timestamp = new Date(lcdBlock.block.header.time)

  if (skipOld && Date.now() - timestamp.getTime() > 86400 * 5 * 1000) {
    return
  }

  const prices = await lcd.getOraclePrices(height)
  const lunaPriceInUST = prices.find((c) => c.denom === 'uusd')?.amount

  if (!lunaPriceInUST) {
    throw new Error(`cannot find uusd price at the height ${height}`)
  }

  const { assets } = (await lcd.getContractStore(getToken(token).pair, { pool: {} }, height)) as any
  let uusdAmount = '0'
  let assetAmount = '0'

  assets.forEach((asset) => {
    if (asset.info.native_token) {
      uusdAmount = asset.amount
    }

    if (asset.info.token) {
      assetAmount = asset.amount
    }
  })

  const priceInUST = new BigNumber(uusdAmount).div(assetAmount)
  const airdrop = priceInUST.dividedBy(lunaPriceInUST).multipliedBy(amount).toFixed(0)

  console.log(timestamp, token, priceInUST.toString(), 'luna', lunaPriceInUST, 'airdrop', airdrop)

  return {
    height,
    timestamp,
    airdrop
  }
}

async function getAirdrops() {
  const airdrops: (Airdrop | undefined)[] = []
  const latestBlock = await lcd.getLatestBlock()

  airdrops.push(await calculateAirdropAtHeight('mir', MIR_AT_SNAPSHOT, MIR_INITIAL_HEIGHT.toString()))

  for (
    let height = MIR_START_HEIGHT;
    height < MIR_END_HEIGHT && height < +latestBlock.block.header.height;
    height += DIST_INTERVAL
  ) {
    airdrops.push(await calculateAirdropAtHeight('mir', MIR_AT_INTERVAL, height.toString()))
  }

  airdrops.push(await calculateAirdropAtHeight('anc', ANC_AT_SNAPSHOT, ANC_INITIAL_HEIGHT.toString()))

  for (
    let height = ANC_START_HEIGHT;
    height < ANC_END_HEIGHT && height < +latestBlock.block.header.height;
    height += DIST_INTERVAL
  ) {
    airdrops.push(await calculateAirdropAtHeight('anc', ANC_AT_INTERVAL, height.toString()))
  }

  airdrops.push(await calculateAirdropAtHeight('mine', MINE_AT_SNAPSHOT, MINE_INITIAL_HEIGHT.toString()))

  for (
    let height = MINE_START_HEIGHT;
    height < MINE_END_HEIGHT && height < +latestBlock.block.header.height;
    height += DIST_INTERVAL
  ) {
    airdrops.push(await calculateAirdropAtHeight('mine', MINE_AT_INTERVAL, height.toString()))
  }

  return airdrops.filter(Boolean) as Airdrop[]
}

async function main() {
  const conns = await init()
  await initToken()

  const rawAirdrops = await getAirdrops()
  const airdropsByDate = rawAirdrops.reduce((p, c) => {
    const timestamp = startOfDay(c.timestamp)
    const existing = p.find((e) => e.timestamp.getTime() === timestamp.getTime())

    if (existing) {
      existing.airdrop = plus(existing.airdrop, c.airdrop)
    } else {
      p.push({ timestamp, airdrop: c.airdrop })
    }

    return p
  }, [] as { timestamp: Date; airdrop: string }[])

  await getManager().transaction((mgr) =>
    Bluebird.mapSeries(airdropsByDate, async (ad) => {
      const dashboard = await mgr.findOneOrFail(DashboardEntity, {
        timestamp: ad.timestamp
      })

      dashboard.airdrop = ad.airdrop
      console.log(`setting airdrop ${dashboard.airdrop} for ${dashboard.timestamp}`)
      return mgr.update(DashboardEntity, { id: dashboard.id }, dashboard)
    })
  )

  await Promise.all(conns.map((c) => c.close()))
}

main().catch(console.error)
