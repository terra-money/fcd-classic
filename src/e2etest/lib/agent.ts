import * as Koa from 'koa'
import * as http from 'http'
import { init } from 'orm'
import { Connection } from 'typeorm'
import * as supertest from 'supertest'
import createApp from 'createApp'

type OrmConnection = Connection | Connection[]

export async function setupAgent(): Promise<{
  connection: OrmConnection
  app: Koa
  server: http.Server
  agent: supertest.SuperTest<supertest.Test>
}> {
  const connection = await init()
  const app = await createApp()

  const server = http.createServer(app.callback())
  const agent = supertest.agent(server)

  return {
    connection,
    app,
    server,
    agent
  }
}

export async function terminateAPITest({ connection }: { connection: OrmConnection }) {
  if (Array.isArray(connection)) {
    await Promise.all(connection.map((c) => c.close()))
    return
  }

  await connection.close()
}
