CREATE SCHEMA IF NOT EXISTS "core";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."party" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" varchar(32) NOT NULL,
	"displayName" text,
	"email" text,
	"createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "party_kind_check" CHECK ("kind" IN ('person', 'organization'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "party_kind_idx" ON "core"."party" USING btree ("kind");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."subject" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" varchar(64) NOT NULL,
	"owner_module" varchar(100) NOT NULL,
	"party_id" uuid NOT NULL,
	"currency" char(3) NOT NULL,
	"expected_minor" integer NOT NULL,
	"settle_state" varchar(32) NOT NULL,
	"createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "subject_settle_state_check" CHECK ("settle_state" IN ('open', 'settled', 'void'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "core"."subject" ADD CONSTRAINT "subject_party_id_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "core"."party"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_owner_module_idx" ON "core"."subject" USING btree ("owner_module");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_party_id_idx" ON "core"."subject" USING btree ("party_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."transaction" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subject_id" uuid NOT NULL,
	"authorized_minor" integer NOT NULL,
	"captured_minor" integer DEFAULT 0 NOT NULL,
	"refunded_minor" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "transaction_captured_lte_authorized" CHECK ("captured_minor" <= "authorized_minor"),
	CONSTRAINT "transaction_refunded_lte_captured" CHECK ("refunded_minor" <= "captured_minor")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "core"."transaction" ADD CONSTRAINT "transaction_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "core"."subject"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_subject_id_idx" ON "core"."transaction" USING btree ("subject_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."module_config" (
	"module_id" varchar(100) NOT NULL,
	"key" varchar(200) NOT NULL,
	"value" jsonb NOT NULL,
	"createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "module_config_module_id_key_unique" UNIQUE("module_id","key")
);
