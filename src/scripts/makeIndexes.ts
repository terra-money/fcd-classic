import { init as initORM } from 'orm'
import { getConnection } from 'typeorm'

async function start() {
  await initORM()
  await getConnection().query(
    `CREATE INDEX tx_msg_index ON tx using gin ((data->'tx'->'value'->'msg') jsonb_path_ops);`
  )
  await getConnection().query(
    `CREATE INDEX block_header_index ON block using gin ((data->'block'->'header') jsonb_path_ops);`
  )
  await getConnection().query(`CREATE INDEX tx_memo_index ON tx((data->'tx'->'value'->>'memo'));`)
  await getConnection().query(`CREATE INDEX tx_timestamp_index ON tx using gin ((data->'timestamp') jsonb_path_ops);`)
}

start().catch(console.error)
