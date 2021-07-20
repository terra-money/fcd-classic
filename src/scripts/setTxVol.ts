import { addDays, format } from 'date-fns'
import { getRepository } from 'typeorm'

import { init as initORM, NetworkEntity } from 'orm'
import * as lcd from 'lib/lcd'
import { getStartOfPreviousMinuteTs } from 'lib/time'

import { getTxVol, getMarketCap } from 'collector/block/network'
import { getAllActivePrices } from 'collector/block/helper'

async function upsert(doc: NetworkEntity) {
  const isExists = await getRepository(NetworkEntity).findOne({
    denom: doc.denom,
    datetime: doc.datetime
  })
  if (isExists) {
    await getRepository(NetworkEntity).update(
      {
        denom: doc.denom,
        datetime: doc.datetime
      },
      doc
    )
  } else {
    await getRepository(NetworkEntity).insert(doc)
  }
}

// For columbus-2
async function main() {
  await initORM()

  const genesisStart = new Date('2019-06-06 00:00:00').getTime()
  const actives = ['ukrw', 'uluna', 'umnt', 'usdr', 'uusd']

  for (let i = 39; i < 40; i = i + 1) {
    let datetime = addDays(genesisStart, i).getTime()

    await Promise.all(actives.map((active) => lcd.getDenomIssuanceAfterGenesis(active, i)))
    // const activeIssuances = issuanceArr.reduce((acc, item: any) => {
    //   acc[item.denom] = item.issuance;
    //   return acc;
    // }, {});
    const activeIssuances = await lcd.getAllActiveIssuance()
    const end = addDays(datetime, 1).getTime()

    datetime += 60000

    while (datetime < end) {
      const volumeObj = await getTxVol(datetime)
      const activePrices = await getAllActivePrices(getStartOfPreviousMinuteTs(datetime))
      const marketCapObj = getMarketCap(activeIssuances, activePrices)

      const docs = actives.map((denom) => {
        const network = new NetworkEntity()
        network.denom = denom
        network.datetime = new Date(getStartOfPreviousMinuteTs(datetime))
        network.supply = activeIssuances[denom]
        network.marketCap = marketCapObj[denom]
        network.txvolume = volumeObj[denom] ? volumeObj[denom] : '0'
        return network
      })
      await Promise.all(docs.map(upsert))
      console.log(`Set network completed. ${format(datetime, 'YYYY-MM-DD HH:mm:ss')}`)
      datetime += 60000
    }
  }
}

main().catch(console.error)
