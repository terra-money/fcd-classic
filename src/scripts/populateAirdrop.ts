import * as Bluebird from 'bluebird'
import BigNumber from 'bignumber.js'
import { getManager } from 'typeorm'
import { init, DashboardEntity } from 'orm'
import { startOfDay } from 'date-fns'
import * as lcd from 'lib/lcd'
import { plus } from 'lib/math'
import { init as initToken, getToken } from 'service/treasury/token'

const MIR_AT_SNAPSHOT = '9150000000000'
const MIR_AT_INTERVAL = '345283000000'
// const SNAPSHOT_HEIGHT = 680000
const MIR_INITIAL_HEIGHT = 825000
const MIR_START_HEIGHT = 920000
// Tequila
// const SNAPSHOT_HEIGHT = 1350000
// const SNAPSHOT_DIST_AT = 1375000
// const DIST_STARTED_AT = 1380000
const DIST_INTERVAL = 100000
const MIR_END_HEIGHT = MIR_START_HEIGHT + DIST_INTERVAL * 53

const ANC_AT_SNAPSHOT = '50000000000000'
const ANC_AT_INTERVAL = '961538461538'
const ANC_INITIAL_HEIGHT = 2211000
const ANC_START_HEIGHT = 2279600
const ANC_END_HEIGHT = ANC_START_HEIGHT + DIST_INTERVAL * 104

interface Airdrop {
  height: string
  timestamp: Date
  airdrop: string
}

/**
 * Returns MIR token airdrop in Luna unit at given height
 * @param height target height for calculation
 */
async function calculateMirAirdropAtHeight(height: string): Promise<Airdrop> {
  if (+height < MIR_INITIAL_HEIGHT || +height > MIR_END_HEIGHT) {
    throw new Error('height out of range')
  }

  const lcdBlock = await lcd.getBlock(height)
  const prices = await lcd.getOraclePrices(height)
  const lunaPriceInUST = prices.find((c) => c.denom === 'uusd')?.amount

  if (!lunaPriceInUST) {
    throw new Error(`cannot find uusd price at the height ${height}`)
  }

  const mirAmount = +height === MIR_INITIAL_HEIGHT ? MIR_AT_SNAPSHOT : MIR_AT_INTERVAL

  const { assets } = (await lcd.getContractStore(getToken('mir').pair, { pool: {} }, height)) as any
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

  const mirPriceInUST = new BigNumber(uusdAmount).div(assetAmount)
  const airdrop = mirPriceInUST.dividedBy(lunaPriceInUST).multipliedBy(mirAmount).toFixed(0)
  const timestamp = new Date(lcdBlock.block.header.time)

  console.log(timestamp, 'mir', mirPriceInUST.toString(), 'luna', lunaPriceInUST, 'airdrop', airdrop)

  return {
    height,
    timestamp,
    airdrop
  }
}

/**
 * Returns MIR token airdrop in Luna unit at given height
 * @param height target height for calculation
 */
async function calculateAncAirdropAtHeight(height: string): Promise<Airdrop> {
  if (+height < ANC_INITIAL_HEIGHT || +height > ANC_END_HEIGHT) {
    throw new Error('height out of range')
  }

  const lcdBlock = await lcd.getBlock(height)
  const prices = await lcd.getOraclePrices(height)
  const lunaPriceInUST = prices.find((c) => c.denom === 'uusd')?.amount

  if (!lunaPriceInUST) {
    throw new Error(`cannot find uusd price at the height ${height}`)
  }

  const ancAmount = +height === ANC_INITIAL_HEIGHT ? ANC_AT_SNAPSHOT : ANC_AT_INTERVAL

  const { assets } = (await lcd.getContractStore(getToken('anc').pair, { pool: {} }, height)) as any
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

  const ancPriceInUST = new BigNumber(uusdAmount).div(assetAmount)
  const airdrop = ancPriceInUST.dividedBy(lunaPriceInUST).multipliedBy(ancAmount).toFixed(0)
  const timestamp = new Date(lcdBlock.block.header.time)

  console.log(timestamp, 'anc', ancPriceInUST.toString(), 'luna', lunaPriceInUST, 'airdrop', airdrop)

  return {
    height,
    timestamp,
    airdrop
  }
}

async function getAirdrops() {
  const airdrops = [await calculateMirAirdropAtHeight(MIR_INITIAL_HEIGHT.toString())]
  const latestBlock = await lcd.getLatestBlock()

  for (let height = MIR_START_HEIGHT; height < +latestBlock.block.header.height; height += DIST_INTERVAL) {
    airdrops.push(await calculateMirAirdropAtHeight(height.toString()))
  }

  airdrops.push(await calculateAncAirdropAtHeight(ANC_INITIAL_HEIGHT.toString()))

  for (let height = ANC_START_HEIGHT; height < +latestBlock.block.header.height; height += DIST_INTERVAL) {
    airdrops.push(await calculateAncAirdropAtHeight(height.toString()))
  }

  return airdrops
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
