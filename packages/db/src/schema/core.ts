import { sql } from "drizzle-orm";
import {
	char,
	check,
	index,
	integer,
	jsonb,
	pgSchema,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const coreSchema = pgSchema("core");

/** A person or organization the Store transacts with. */
export const party = coreSchema.table(
	"party",
	{
		id: uuid().primaryKey().notNull(),
		kind: varchar({ length: 32 }).notNull(),
		displayName: text(),
		email: text(),
		createdAt: timestamp({ withTimezone: true, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ withTimezone: true, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("party_kind_idx").on(table.kind),
		check("party_kind_check", sql`${table.kind} IN ('person', 'organization')`),
	],
);

/** The thing money is owed against, owned by whichever Module created it. */
export const subject = coreSchema.table(
	"subject",
	{
		id: uuid().primaryKey().notNull(),
		kind: varchar({ length: 64 }).notNull(),
		ownerModule: varchar("owner_module", { length: 100 }).notNull(),
		partyId: uuid("party_id")
			.notNull()
			.references(() => party.id, { onDelete: "restrict" }),
		currency: char({ length: 3 }).notNull(),
		expectedMinor: integer("expected_minor").notNull(),
		settleState: varchar("settle_state", { length: 32 }).notNull(),
		createdAt: timestamp({ withTimezone: true, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ withTimezone: true, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("subject_owner_module_idx").on(table.ownerModule),
		index("subject_party_id_idx").on(table.partyId),
		check(
			"subject_settle_state_check",
			sql`${table.settleState} IN ('open', 'settled', 'void')`,
		),
	],
);

/** A money movement against one Subject. */
export const transaction = coreSchema.table(
	"transaction",
	{
		id: uuid().primaryKey().notNull(),
		subjectId: uuid("subject_id")
			.notNull()
			.references(() => subject.id, { onDelete: "restrict" }),
		authorizedMinor: integer("authorized_minor").notNull(),
		capturedMinor: integer("captured_minor").notNull().default(0),
		refundedMinor: integer("refunded_minor").notNull().default(0),
		createdAt: timestamp({ withTimezone: true, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ withTimezone: true, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("transaction_subject_id_idx").on(table.subjectId),
		check(
			"transaction_captured_lte_authorized",
			sql`${table.capturedMinor} <= ${table.authorizedMinor}`,
		),
		check(
			"transaction_refunded_lte_captured",
			sql`${table.refundedMinor} <= ${table.capturedMinor}`,
		),
	],
);

/** Config-tier key/value store shared across Modules. */
export const moduleConfig = coreSchema.table(
	"module_config",
	{
		moduleId: varchar("module_id", { length: 100 }).notNull(),
		key: varchar({ length: 200 }).notNull(),
		value: jsonb().notNull(),
		createdAt: timestamp({ withTimezone: true, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ withTimezone: true, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		unique("module_config_module_id_key_unique").on(table.moduleId, table.key),
	],
);

export const coreTables = {
	party,
	subject,
	transaction,
	moduleConfig,
};
