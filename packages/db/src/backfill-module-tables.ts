import {
	CURATED_STORE_MODULES,
	isCuratedStoreModule,
} from "@86d-app/core/curated-modules";
import { compileModuleDeclarations, emitSql } from "@86d-app/core/schema";
import type { Module } from "@86d-app/core/types/module";
import type { z } from "@86d-app/core/zod";
import type { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/pglite";
import type pg from "pg";
import { loadCuratedModules } from "./load-curated-modules";
import { applyDisposableDdl } from "./schema/apply-disposable-ddl";
import { ShadowTableStore } from "./schema/compiled-table-drizzle";

export type ModuleDataRow = Readonly<{
	moduleName: string;
	entityType: string;
	entityId: string;
	data: unknown;
}>;

export type BackfillRejection = Readonly<{
	module: string;
	entityType: string;
	entityId: string;
	reason: string;
}>;

export type BackfillSummary = Readonly<{
	copied: number;
	rejected: number;
	skipped: number;
	rejections: readonly BackfillRejection[];
}>;

type EntityShapeEntry = Readonly<{
	moduleId: string;
	shape: z.ZodObject<z.ZodRawShape>;
}>;

function buildEntityShapeMap(
	modules: readonly Module[],
): ReadonlyMap<string, EntityShapeEntry> {
	const map = new Map<string, EntityShapeEntry>();
	for (const module of modules) {
		if (!module.tables) {
			continue;
		}
		for (const [entityType, declaration] of Object.entries(module.tables)) {
			map.set(`${module.id}:${entityType}`, {
				moduleId: module.id,
				shape: declaration.shape,
			});
		}
	}
	return map;
}

function formatZodIssues(error: z.ZodError): string {
	return error.issues
		.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
		.join("; ");
}

export function formatBackfillRejection(rejection: BackfillRejection): string {
	return `REJECT module=${rejection.module} entityType=${rejection.entityType} entityId=${rejection.entityId} reason=${rejection.reason}`;
}

export async function backfillModuleTables(
	options: Readonly<{
		rows: readonly ModuleDataRow[];
		modules: readonly Module[];
		shadow: ShadowTableStore;
	}>,
): Promise<BackfillSummary> {
	const shapeMap = buildEntityShapeMap(options.modules);
	let copied = 0;
	let rejected = 0;
	let skipped = 0;
	const rejections: BackfillRejection[] = [];

	for (const row of options.rows) {
		if (!isCuratedStoreModule(row.moduleName)) {
			skipped += 1;
			continue;
		}

		const shapeEntry = shapeMap.get(`${row.moduleName}:${row.entityType}`);
		if (!shapeEntry) {
			skipped += 1;
			continue;
		}

		const parsed = shapeEntry.shape.safeParse(row.data);
		if (!parsed.success) {
			rejected += 1;
			rejections.push({
				module: row.moduleName,
				entityType: row.entityType,
				entityId: row.entityId,
				reason: `zod:${formatZodIssues(parsed.error)}`,
			});
			continue;
		}

		try {
			await options.shadow.insert(
				shapeEntry.moduleId,
				row.entityType,
				row.entityId,
				parsed.data as Record<string, unknown>,
			);
			copied += 1;
		} catch (error) {
			rejected += 1;
			const message =
				error instanceof Error ? error.message : "constraint violation";
			rejections.push({
				module: row.moduleName,
				entityType: row.entityType,
				entityId: row.entityId,
				reason: `constraint:${message}`,
			});
		}
	}

	rejections.sort((a, b) =>
		`${a.module}:${a.entityType}:${a.entityId}`.localeCompare(
			`${b.module}:${b.entityType}:${b.entityId}`,
		),
	);

	return { copied, rejected, skipped, rejections };
}

export function printBackfillReport(summary: BackfillSummary): void {
	console.log(
		`Backfill summary: copied=${summary.copied} rejected=${summary.rejected} skipped=${summary.skipped}`,
	);
	for (const rejection of summary.rejections) {
		console.log(formatBackfillRejection(rejection));
	}
}

async function fetchModuleDataRows(pool: pg.Pool): Promise<ModuleDataRow[]> {
	const result = await pool.query<{
		moduleName: string;
		entityType: string;
		entityId: string;
		data: unknown;
	}>(
		`SELECT m.name AS "moduleName", md."entityType", md."entityId", md.data
     FROM "ModuleData" md
     JOIN "Module" m ON m.id = md."moduleId"
     WHERE m.name = ANY($1::text[])
     ORDER BY m.name, md."entityType", md."entityId"`,
		[CURATED_STORE_MODULES],
	);
	return result.rows;
}

export async function runBackfillReport(
	pool: pg.Pool,
): Promise<BackfillSummary> {
	const modules = await loadCuratedModules();
	const report = compileModuleDeclarations(modules);
	const moduleSql = emitSql(report.transcoded);

	const executor = {
		async exec(statement: string) {
			await pool.query(statement);
		},
	};
	await applyDisposableDdl(executor, { moduleSql });

	const db = drizzleNodePg(pool);
	const shadow = new ShadowTableStore({ db, compiled: report.transcoded });
	const rows = await fetchModuleDataRows(pool);
	const summary = await backfillModuleTables({ rows, modules, shadow });
	printBackfillReport(summary);
	return summary;
}

export async function createPgliteBackfillContext(client: PGlite) {
	const modules = await loadCuratedModules();
	const report = compileModuleDeclarations(modules);
	const moduleSql = emitSql(report.transcoded);
	const executor = {
		async exec(statement: string) {
			await client.exec(statement);
		},
	};
	await applyDisposableDdl(executor, { moduleSql });
	const db = drizzle(client);
	const shadow = new ShadowTableStore({ db, compiled: report.transcoded });
	return { modules, shadow, report };
}
