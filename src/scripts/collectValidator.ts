import { init } from 'orm'
import { collectValidator } from 'collector/staking'

async function main() {
  const conns = await init()
  await collectValidator()
  await Promise.all(conns.map((c) => c.close))
}

main().catch(console.error)
