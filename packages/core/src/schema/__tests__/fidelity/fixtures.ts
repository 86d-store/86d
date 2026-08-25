import { z } from "../../../zod";
import { col } from "../../col";
import { compileTableShape } from "../../compile/analyze-zod";
import { emitSql } from "../../compile/index";
import type { CompiledTable } from "../../compile/types";

export type FidelityExpectation = Readonly<{
	/** Assert properties of the compiled column / emitted SQL. */
	assert: (table: CompiledTable, sql: string) => void;
}>;

export type FidelityFixture = Readonly<{
	id: string;
	description: string;
	build: () => {
		moduleId: string;
		tableName: string;
		shape: z.ZodObject<z.ZodRawShape>;
		excludes?: readonly {
			using: "gist" | "btree";
			with: string;
			where?: string;
		}[];
	};
	expectation: FidelityExpectation;
}>;

function compileFixture(fixture: FidelityFixture): {
	table: CompiledTable;
	sql: string;
} {
	const built = fixture.build();
	const table = compileTableShape({
		moduleId: built.moduleId,
		tableName: built.tableName,
		shape: built.shape,
		...(built.excludes ? { excludes: built.excludes } : {}),
	});
	const sql = emitSql([
		{
			moduleId: built.moduleId,
			tables: [table],
		},
	]);
	return { table, sql };
}

export function runFidelityFixture(fixture: FidelityFixture): void {
	const { table, sql } = compileFixture(fixture);
	fixture.expectation.assert(table, sql);
}

/** One focused fixture per support-boundary construct id. */
export const FIDELITY_FIXTURES: readonly FidelityFixture[] = [
	{
		id: "zod.string",
		description: "plain string → text NOT NULL",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				name: z.string(),
			}),
		}),
		expectation: {
			assert: (table) => {
				const name = table.columns.find((c) => c.name === "name");
				if (name?.sqlType !== "text" || name.nullable) {
					throw new Error("zod.string fidelity failed");
				}
			},
		},
	},
	{
		id: "zod.uuid",
		description: "uuid format → uuid",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.uuid().register(col, { pk: true }),
			}),
		}),
		expectation: {
			assert: (table) => {
				const id = table.columns.find((c) => c.name === "id");
				if (id?.sqlType !== "uuid") {
					throw new Error("zod.uuid fidelity failed");
				}
			},
		},
	},
	{
		id: "zod.number",
		description: "number → double precision",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				amount: z.number(),
			}),
		}),
		expectation: {
			assert: (table) => {
				const amount = table.columns.find((c) => c.name === "amount");
				if (amount?.sqlType !== "double precision") {
					throw new Error("zod.number fidelity failed");
				}
			},
		},
	},
	{
		id: "zod.int",
		description: "int → integer",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				qty: z.int(),
			}),
		}),
		expectation: {
			assert: (table) => {
				const qty = table.columns.find((c) => c.name === "qty");
				if (qty?.sqlType !== "integer") {
					throw new Error("zod.int fidelity failed");
				}
			},
		},
	},
	{
		id: "zod.boolean",
		description: "boolean → boolean",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				active: z.boolean(),
			}),
		}),
		expectation: {
			assert: (table) => {
				const active = table.columns.find((c) => c.name === "active");
				if (active?.sqlType !== "boolean" || active.nullable) {
					throw new Error("zod.boolean fidelity failed");
				}
			},
		},
	},
	{
		id: "zod.date",
		description: "date → timestamptz",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				createdAt: z.date(),
			}),
		}),
		expectation: {
			assert: (table) => {
				const createdAt = table.columns.find((c) => c.name === "createdAt");
				if (createdAt?.sqlType !== "timestamptz") {
					throw new Error("zod.date fidelity failed");
				}
			},
		},
	},
	{
		id: "zod.date.coerce",
		description: "coerce.date → timestamptz",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				createdAt: z.coerce.date(),
			}),
		}),
		expectation: {
			assert: (table) => {
				const createdAt = table.columns.find((c) => c.name === "createdAt");
				if (createdAt?.sqlType !== "timestamptz") {
					throw new Error("zod.date.coerce fidelity failed");
				}
			},
		},
	},
	{
		id: "zod.enum",
		description: "enum → text with domain CHECK",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				status: z.enum(["active", "abandoned"]),
			}),
		}),
		expectation: {
			assert: (table, sql) => {
				const status = table.columns.find((c) => c.name === "status");
				if (
					!status?.checkConstraints.some((c) => c.includes("'active'")) ||
					!sql.includes("CHECK")
				) {
					throw new Error("zod.enum fidelity failed");
				}
			},
		},
	},
	{
		id: "zod.enum.values",
		description: "enum values preserved in CHECK list",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				status: z.enum(["active", "abandoned", "converted"]),
			}),
		}),
		expectation: {
			assert: (table) => {
				const status = table.columns.find((c) => c.name === "status");
				if (
					status?.enumValues?.length !== 3 ||
					!status.checkConstraints.some((c) => c.includes("converted"))
				) {
					throw new Error("zod.enum.values fidelity failed");
				}
			},
		},
	},
	{
		id: "zod.record",
		description: "record → jsonb",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				metadata: z.record(z.string(), z.unknown()),
			}),
		}),
		expectation: {
			assert: (table) => {
				const metadata = table.columns.find((c) => c.name === "metadata");
				if (metadata?.sqlType !== "jsonb") {
					throw new Error("zod.record fidelity failed");
				}
			},
		},
	},
	{
		id: "zod.array",
		description: "bounded array → jsonb with array-length CHECK",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				tags: z.array(z.string()).max(5),
			}),
		}),
		expectation: {
			assert: (table, sql) => {
				const tags = table.columns.find((c) => c.name === "tags");
				if (
					tags?.sqlType !== "jsonb" ||
					!sql.includes('jsonb_array_length("tags") <= 5') ||
					sql.includes('char_length("tags")')
				) {
					throw new Error("zod.array fidelity failed");
				}
			},
		},
	},
	{
		id: "zod.object",
		description: "object → jsonb",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				payload: z.object({ nest: z.string() }),
			}),
		}),
		expectation: {
			assert: (table) => {
				const payload = table.columns.find((c) => c.name === "payload");
				if (payload?.sqlType !== "jsonb") {
					throw new Error("zod.object fidelity failed");
				}
			},
		},
	},
	{
		id: "wrapper.optional",
		description: "optional → SQL nullable, optional input",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				notes: z.string().optional(),
			}),
		}),
		expectation: {
			assert: (table) => {
				const notes = table.columns.find((c) => c.name === "notes");
				if (!notes?.nullable || !notes.optional) {
					throw new Error("wrapper.optional fidelity failed");
				}
			},
		},
	},
	{
		id: "wrapper.nullable",
		description: "nullable → SQL nullable",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				notes: z.string().nullable(),
			}),
		}),
		expectation: {
			assert: (table) => {
				const notes = table.columns.find((c) => c.name === "notes");
				if (!notes?.nullable) {
					throw new Error("wrapper.nullable fidelity failed");
				}
			},
		},
	},
	{
		id: "wrapper.default",
		description: "default wrapper → SQL DEFAULT",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				status: z.string().default("active"),
			}),
		}),
		expectation: {
			assert: (table, sql) => {
				const status = table.columns.find((c) => c.name === "status");
				if (
					status?.sqlDefault !== "'active'" ||
					!sql.includes("DEFAULT 'active'")
				) {
					throw new Error("wrapper.default fidelity failed");
				}
			},
		},
	},
	{
		id: "default.value",
		description: "scalar default value emitted",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				count: z.int().default(0),
			}),
		}),
		expectation: {
			assert: (table) => {
				const count = table.columns.find((c) => c.name === "count");
				if (count?.sqlDefault !== "0") {
					throw new Error("default.value fidelity failed");
				}
			},
		},
	},
	{
		id: "check.min",
		description: "int.min emits CHECK lower bound",
		build: () => ({
			moduleId: "appointments",
			tableName: "appointment",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				minutes: z.int().min(5),
			}),
		}),
		expectation: {
			assert: (table) => {
				const minutes = table.columns.find((c) => c.name === "minutes");
				if (!minutes?.checkConstraints.some((c) => c.includes(">= 5"))) {
					throw new Error("check.min fidelity failed");
				}
			},
		},
	},
	{
		id: "check.max",
		description: "int.max emits CHECK upper bound",
		build: () => ({
			moduleId: "appointments",
			tableName: "appointment",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				minutes: z.int().max(480),
			}),
		}),
		expectation: {
			assert: (table) => {
				const minutes = table.columns.find((c) => c.name === "minutes");
				if (!minutes?.checkConstraints.some((c) => c.includes("<= 480"))) {
					throw new Error("check.max fidelity failed");
				}
			},
		},
	},
	{
		id: "check.min_length",
		description: "string.min emits length CHECK",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				code: z.string().min(2),
			}),
		}),
		expectation: {
			assert: (table) => {
				const code = table.columns.find((c) => c.name === "code");
				if (
					!code?.checkConstraints.some((c) =>
						c.includes('char_length("code") >= 2'),
					)
				) {
					throw new Error("check.min_length fidelity failed");
				}
			},
		},
	},
	{
		id: "check.max_length",
		description: "string.max emits varchar width",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				notes: z.string().max(2000),
			}),
		}),
		expectation: {
			assert: (table) => {
				const notes = table.columns.find((c) => c.name === "notes");
				if (notes?.sqlType !== "varchar(2000)") {
					throw new Error("check.max_length fidelity failed");
				}
			},
		},
	},
	{
		id: "meta.pk",
		description: "col pk marks primary key and NOT NULL",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
			}),
		}),
		expectation: {
			assert: (table) => {
				if (
					table.primaryKey[0] !== "id" ||
					table.columns[0]?.nullable !== false
				) {
					throw new Error("meta.pk fidelity failed");
				}
			},
		},
	},
	{
		id: "meta.index",
		description: "col index emits CREATE INDEX",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				slug: z.string().register(col, { index: true }),
			}),
		}),
		expectation: {
			assert: (_table, sql) => {
				if (!sql.includes("CREATE INDEX IF NOT EXISTS")) {
					throw new Error("meta.index fidelity failed");
				}
			},
		},
	},
	{
		id: "meta.unique",
		description: "col unique emits unique index",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				email: z.string().register(col, { unique: true }),
			}),
		}),
		expectation: {
			assert: (_table, sql) => {
				if (!sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS")) {
					throw new Error("meta.unique fidelity failed");
				}
			},
		},
	},
	{
		id: "meta.sensitive",
		description: "sensitive metadata retained on column",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				notes: z.string().register(col, { sensitive: true }),
			}),
		}),
		expectation: {
			assert: (table) => {
				const notes = table.columns.find((c) => c.name === "notes");
				if (!notes?.meta.sensitive) {
					throw new Error("meta.sensitive fidelity failed");
				}
			},
		},
	},
	{
		id: "meta.anchor",
		description: "anchor metadata retained on column",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				subjectId: z.string().register(col, { anchor: true }),
			}),
		}),
		expectation: {
			assert: (table) => {
				const subjectId = table.columns.find((c) => c.name === "subjectId");
				if (!subjectId?.meta.anchor) {
					throw new Error("meta.anchor fidelity failed");
				}
			},
		},
	},
	{
		id: "meta.references.cascade",
		description: "references onDelete cascade",
		build: () => ({
			moduleId: "cart",
			tableName: "cartItem",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				cartId: z.string().register(col, {
					references: {
						table: "self.cart",
						column: "id",
						onDelete: "cascade",
					},
				}),
			}),
		}),
		expectation: {
			assert: (table, sql) => {
				const fk = table.foreignKeys[0];
				if (fk?.onDelete !== "cascade" || !sql.includes("ON DELETE CASCADE")) {
					throw new Error("meta.references.cascade fidelity failed");
				}
			},
		},
	},
	{
		id: "meta.references.restrict",
		description: "references onDelete restrict",
		build: () => ({
			moduleId: "cart",
			tableName: "cartItem",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				cartId: z.string().register(col, {
					references: {
						table: "self.cart",
						column: "id",
						onDelete: "restrict",
					},
				}),
			}),
		}),
		expectation: {
			assert: (table) => {
				if (table.foreignKeys[0]?.onDelete !== "restrict") {
					throw new Error("meta.references.restrict fidelity failed");
				}
			},
		},
	},
	{
		id: "meta.references.set null",
		description: "references onDelete set null",
		build: () => ({
			moduleId: "products",
			tableName: "product",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				categoryId: z
					.string()
					.register(col, {
						references: {
							table: "self.category",
							column: "id",
							onDelete: "set null",
						},
					})
					.optional(),
			}),
		}),
		expectation: {
			assert: (table) => {
				if (table.foreignKeys[0]?.onDelete !== "set null") {
					throw new Error("meta.references.set null fidelity failed");
				}
			},
		},
	},
	{
		id: "meta.references.no action",
		description: "references onDelete no action",
		build: () => ({
			moduleId: "cart",
			tableName: "cartItem",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				cartId: z.string().register(col, {
					references: {
						table: "self.cart",
						column: "id",
						onDelete: "no action",
					},
				}),
			}),
		}),
		expectation: {
			assert: (table) => {
				if (table.foreignKeys[0]?.onDelete !== "no action") {
					throw new Error("meta.references.no action fidelity failed");
				}
			},
		},
	},
	{
		id: "meta.references.table.self",
		description: "self.* reference resolves to mod_ schema",
		build: () => ({
			moduleId: "cart",
			tableName: "cartItem",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				cartId: z.string().register(col, {
					references: { table: "self.cart", column: "id" },
				}),
			}),
		}),
		expectation: {
			assert: (table) => {
				const fk = table.foreignKeys[0];
				if (
					fk?.referencedSchema !== "mod_cart" ||
					fk.referencedTable !== "cart"
				) {
					throw new Error("meta.references.table.self fidelity failed");
				}
			},
		},
	},
	{
		id: "meta.references.table.core",
		description: "core.* reference resolves to core schema",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				partyId: z.string().register(col, {
					references: { table: "core.party", column: "id" },
				}),
			}),
		}),
		expectation: {
			assert: (table) => {
				const fk = table.foreignKeys[0];
				if (fk?.referencedSchema !== "core" || fk.referencedTable !== "party") {
					throw new Error("meta.references.table.core fidelity failed");
				}
			},
		},
	},
	{
		id: "table.exclude",
		description: "table excludes emit EXCLUDE constraint",
		build: () => ({
			moduleId: "appointments",
			tableName: "appointment",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
			}),
			excludes: [
				{
					using: "gist",
					with: "staff_id WITH =, tstzrange(starts_at, ends_at) WITH &&",
				},
			],
		}),
		expectation: {
			assert: (_table, sql) => {
				if (!sql.includes("EXCLUDE USING gist")) {
					throw new Error("table.exclude fidelity failed");
				}
			},
		},
	},
	{
		id: "module.tier_none",
		description: "tier-none modules produce empty compile",
		build: () => ({
			moduleId: "stripe",
			tableName: "unused",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
			}),
		}),
		expectation: {
			assert: () => {
				// Coverage marker only — inventory provenance is asserted in the gate.
			},
		},
	},
	{
		id: "required.not_null",
		description: "required non-PK column is NOT NULL",
		build: () => ({
			moduleId: "cart",
			tableName: "cart",
			shape: z.object({
				id: z.string().register(col, { pk: true }),
				status: z.string(),
			}),
		}),
		expectation: {
			assert: (table, sql) => {
				const status = table.columns.find((c) => c.name === "status");
				if (
					status?.nullable !== false ||
					!sql.includes('"status" text NOT NULL')
				) {
					throw new Error("required.not_null fidelity failed");
				}
			},
		},
	},
];

export const FIDELITY_FIXTURE_IDS = new Set(
	FIDELITY_FIXTURES.map((fixture) => fixture.id),
);
