import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260704060621 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cart_merge" drop constraint if exists "cart_merge_source_cart_id_unique";`);
    this.addSql(`create table if not exists "cart_merge" ("id" text not null, "source_cart_id" text not null, "target_cart_id" text not null, "customer_id" text not null, "mode" text check ("mode" in ('ownership_transfer', 'merge_into_existing')) not null, "status" text check ("status" in ('pending', 'completed', 'failed')) not null default 'pending', "plan" jsonb not null, "failure_code" text null, "attempt_count" integer not null default 1, "completed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cart_merge_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cart_merge_source_cart_id_unique" ON "cart_merge" ("source_cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_merge_deleted_at" ON "cart_merge" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_merge_customer_status" ON "cart_merge" ("customer_id", "status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_merge_target_cart_id" ON "cart_merge" ("target_cart_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cart_merge" cascade;`);
  }

}
