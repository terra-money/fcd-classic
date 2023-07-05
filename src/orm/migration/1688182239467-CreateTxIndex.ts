import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateTxIndex1688182239467 implements MigrationInterface {
  name = 'CreateTxIndex1688182239467'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."tx_memo_index_gin"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."tx_timestamp_index_gin"`)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "tx_msg_index_gin" ON "public"."tx" USING gin ((data->'tx'->'value'->'msg') jsonb_path_ops)`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."tx_msg_index_gin"`)
  }
}
