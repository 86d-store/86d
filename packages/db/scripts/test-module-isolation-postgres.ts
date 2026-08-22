/**
 * Docker/standalone mode proof for Module storage isolation (plan 003).
 *
 * Spins a disposable postgres:16-alpine, applies framework + curated Module DDL
 * (including compiled isolation), asserts catalog facts, and runs denial probes.
 *
 * Usage (from public/):
 *   bun packages/db/scripts/test-module-isolation-postgres.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	compileIsolationArtifacts,
	compileModuleDeclarations,
	emitIsolationSql,
	emitSql,
	STORE_LOGIN_ROLE,
	STORE_OWNER_ROLE,
} from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import type { Module } from "@86d-app/core/types/module";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";
import { loadCuratedModules } from "../src/load-curated-modules.ts";
import {
	applyDisposableDdl,
	applyModuleDdl,
} from "../src/schema/apply-disposable-ddl.ts";

const scriptRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const packageRoot = resolve(scriptRoot, "..");
const repoRoot = resolve(packageRoot, "../..");
const containerName = `86d-module-isolation-${process.pid}-${randomUUID().slice(0, 8)}`;
const databaseName = "module_isolation_proof";
const databasePassword = "isolation-proof";
const STATEMENT_TIMEOUT_MS = 5_000;

const privilegeMatrixPath = join(
	repoRoot,
	"../prd/evidence/module-privilege-matrix.json",
);

type PrivilegeMatrix = {
	storeRoles: string[];
	modules: Array<{
		moduleId: string;
		roleName: string;
		schemaName: string;
		statementTimeoutMs: number;
	}>;
};

function docker(args: readonly string[]): string {
	return execFileSync("docker", [...args], {
		encoding: "utf8",
		maxBuffer: 10 * 1024 * 1024,
	});
}

let containerRunning = false;
function cleanupContainer(): void {
	if (!containerRunning) return;
	containerRunning = false;
	try {
		docker(["stop", containerName]);
	} catch {
		// Disposable container may already have exited.
	}
}

process.once("exit", cleanupContainer);
process.once("SIGINT", () => {
	cleanupContainer();
	process.exit(130);
});
process.once("SIGTERM", () => {
	cleanupContainer();
	process.exit(143);
});

async function queryRows<T extends Record<string, unknown>>(
	client: PoolClient,
	sql: string,
	params: unknown[] = [],
): Promise<T[]> {
	const result = await client.query<T>(sql, params);
	return result.rows;
}

async function expectRejects(
	client: PoolClient,
	label: string,
	run: () => Promise<unknown>,
): Promise<void> {
	const sp = `sp_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
	await client.query(`SAVEPOINT ${sp}`);
	let failed = false;
	try {
		await run();
	} catch {
		failed = true;
	}
	await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
	assert.equal(failed, true, `${label}: expected failure`);
}

function buildPublishFixture(): {
	modules: Module[];
	viewGrants: Record<
		string,
		readonly { publisherModuleId: string; viewName: string }[]
	>;
	sql: string;
} {
	const publisher: Module = {
		id: "iso_pub",
		version: "1.0.0",
		storage: {
			kind: "relational",
			config: {
				guest_ttl_days: z.number().int().min(1).max(30),
			},
			tables: {
				item: {
					shape: z.object({
						id: z.string().register(col, { pk: true }),
						status: z.enum(["active", "hidden"]),
						secret: z.string(),
					}),
				},
			},
			publishes: {
				item: {
					version: "1.0.0",
					table: "item",
					columns: ["id", "status"],
				},
			},
		},
	};
	const consumer: Module = {
		id: "iso_con",
		version: "1.0.0",
		storage: {
			kind: "relational",
			tables: {
				note: {
					shape: z.object({
						id: z.string().register(col, { pk: true }),
						body: z.string(),
					}),
				},
			},
		},
	};
	const modules = [publisher, consumer];
	const report = compileModuleDeclarations(modules);
	const viewGrants = {
		iso_con: [{ publisherModuleId: "iso_pub", viewName: "item" }],
	};
	const isolation = emitIsolationSql(
		compileIsolationArtifacts(modules),
		report.transcoded,
		{ viewGrants },
	);
	const sql = `${emitSql(report.transcoded)}\n${isolation}`;
	return { modules, viewGrants, sql };
}

async function main(): Promise<void> {
	const startedAt = new Date().toISOString();
	// biome-ignore lint/suspicious/noConsole: proof script emits progress for operators.
	console.log(`module isolation postgres proof starting at ${startedAt}`);

	docker([
		"run",
		"--detach",
		"--rm",
		"--name",
		containerName,
		"--publish",
		"127.0.0.1::5432",
		"--env",
		`POSTGRES_PASSWORD=${databasePassword}`,
		"--env",
		`POSTGRES_DB=${databaseName}`,
		"postgres:16-alpine",
	]);
	containerRunning = true;

	let databaseReady = false;
	for (let attempt = 0; attempt < 40; attempt += 1) {
		try {
			docker([
				"exec",
				containerName,
				"pg_isready",
				"--username",
				"postgres",
				"--dbname",
				databaseName,
			]);
			databaseReady = true;
			break;
		} catch {
			await Bun.sleep(250);
		}
	}
	assert.equal(
		databaseReady,
		true,
		"PostgreSQL container did not become ready",
	);

	const portOutput = docker(["port", containerName, "5432/tcp"]).trim();
	const port = /:(\d+)$/.exec(portOutput)?.[1];
	assert.ok(port, `Could not resolve PostgreSQL port from ${portOutput}`);

	const connectionString = `postgresql://postgres:${databasePassword}@127.0.0.1:${port}/${databaseName}`;
	const pool = new Pool({ connectionString, max: 4 });
	const client = await pool.connect();

	const results: Array<{ check: string; result: string }> = [];

	try {
		const initSql = readFileSync(
			join(packageRoot, "../../internals/docker/init.sql"),
			"utf8",
		);
		await client.query(initSql);

		const curated = await loadCuratedModules();
		const curatedReport = compileModuleDeclarations(curated);
		assert.ok(
			curatedReport.sql.includes("CREATE ROLE"),
			"curated compile must emit isolation roles",
		);

		const executor = {
			async exec(statement: string) {
				await client.query(statement);
			},
		};
		await applyDisposableDdl(executor, { moduleSql: curatedReport.sql });

		const matrix = JSON.parse(
			readFileSync(privilegeMatrixPath, "utf8"),
		) as PrivilegeMatrix;
		assert.deepEqual(
			matrix.storeRoles.sort(),
			[STORE_LOGIN_ROLE, STORE_OWNER_ROLE].sort(),
		);

		const roles = await queryRows<{ rolname: string }>(
			client,
			`SELECT rolname FROM pg_roles
       WHERE rolname = ANY($1::text[])
       ORDER BY rolname`,
			[[STORE_LOGIN_ROLE, STORE_OWNER_ROLE]],
		);
		assert.deepEqual(
			roles.map((r) => r.rolname).sort(),
			[STORE_LOGIN_ROLE, STORE_OWNER_ROLE].sort(),
		);
		results.push({ check: "store roles exist", result: "pass" });

		const curatedRelational = curated.filter((module) => {
			const storage = module.storage;
			return storage?.kind === "relational" || storage?.kind === "config";
		});

		for (const module of curatedRelational) {
			const expected = matrix.modules.find((m) => m.moduleId === module.id);
			assert.ok(expected, `privilege matrix missing ${module.id}`);

			const roleRows = await queryRows<{
				rolname: string;
				rolconfig: string[] | null;
			}>(client, `SELECT rolname, rolconfig FROM pg_roles WHERE rolname = $1`, [
				expected.roleName,
			]);
			assert.equal(roleRows.length, 1, `missing role ${expected.roleName}`);
			const timeoutSetting = (roleRows[0]?.rolconfig ?? []).find((entry) =>
				entry.startsWith("statement_timeout="),
			);
			assert.ok(
				timeoutSetting,
				`statement_timeout missing on ${expected.roleName}`,
			);
			assert.match(
				timeoutSetting,
				new RegExp(`statement_timeout=${expected.statementTimeoutMs}`),
			);

			const schemaRows = await queryRows<{ nspname: string }>(
				client,
				`SELECT nspname FROM pg_namespace WHERE nspname = $1`,
				[expected.schemaName],
			);
			assert.equal(
				schemaRows.length,
				1,
				`missing schema ${expected.schemaName}`,
			);
		}
		results.push({
			check: "curated role/schema/timeout catalog",
			result: `pass (${curatedRelational.length} modules)`,
		});

		const loginPrivs = await queryRows<{ has_usage: boolean }>(
			client,
			`SELECT has_schema_privilege($1::name, $2::regnamespace, 'USAGE') AS has_usage`,
			[STORE_LOGIN_ROLE, "mod_products"],
		);
		assert.equal(
			loginPrivs[0]?.has_usage,
			false,
			"store_login must not have USAGE on mod_products",
		);
		results.push({
			check: "login role lacks module schema usage",
			result: "pass",
		});

		// Synthetic publisher/consumer for published-view and Config denials.
		const fixture = buildPublishFixture();
		await applyModuleDdl(executor, fixture.sql);

		await client.query(
			`INSERT INTO "mod_iso_pub"."item" (id, status, secret)
       VALUES ('item_1', 'active', 'classified')
       ON CONFLICT (id) DO NOTHING`,
		);

		await client.query("BEGIN");
		await client.query(`SET LOCAL ROLE ${STORE_LOGIN_ROLE}`);
		await expectRejects(
			client,
			"login without module role cannot read publisher table",
			() => client.query(`SELECT id FROM "mod_iso_pub"."item" LIMIT 1`),
		);
		await client.query("ROLLBACK");
		results.push({
			check: "missed SET LOCAL ROLE fails closed",
			result: "pass",
		});

		await client.query("BEGIN");
		await client.query(`SET LOCAL ROLE ${STORE_LOGIN_ROLE}`);
		await client.query(`SET LOCAL ROLE mod_iso_pub`);
		const ownRows = await queryRows<{ id: string; secret: string }>(
			client,
			`SELECT id, secret FROM "mod_iso_pub"."item" WHERE id = 'item_1'`,
		);
		assert.equal(ownRows[0]?.secret, "classified");

		await expectRejects(client, "publisher cannot read consumer schema", () =>
			client.query(`SELECT id FROM "mod_iso_con"."note" LIMIT 1`),
		);
		await client.query("ROLLBACK");

		await client.query("BEGIN");
		await client.query(`SET LOCAL ROLE ${STORE_LOGIN_ROLE}`);
		await client.query(`SET LOCAL ROLE mod_iso_con`);

		const viewRows = await queryRows<Record<string, unknown>>(
			client,
			`SELECT * FROM "pub"."iso_pub__item" WHERE id = 'item_1'`,
		);
		assert.equal(viewRows.length, 1);
		assert.equal(viewRows[0]?.id, "item_1");
		assert.equal(viewRows[0]?.status, "active");
		assert.equal(
			Object.hasOwn(viewRows[0] ?? {}, "secret"),
			false,
			"unpublished column must be absent from published view",
		);
		results.push({
			check: "published view hides unpublished columns",
			result: "pass",
		});

		await expectRejects(
			client,
			"consumer cannot read publisher base schema",
			() => client.query(`SELECT secret FROM "mod_iso_pub"."item" LIMIT 1`),
		);
		results.push({
			check: "consumer denied publisher base table",
			result: "pass",
		});
		await client.query("ROLLBACK");

		await client.query("BEGIN");
		await client.query(`SET LOCAL ROLE ${STORE_LOGIN_ROLE}`);
		await client.query(`SET LOCAL ROLE mod_iso_pub`);
		await expectRejects(client, "config allow-list denies foreign key", () =>
			client.query(`SELECT core.cfg_iso_pub_get('foreign_key')`),
		);
		await client.query(
			`SELECT core.cfg_iso_pub_upsert('guest_ttl_days', '7'::jsonb)`,
		);
		const cfg = await queryRows<{ cfg_iso_pub_get: unknown }>(
			client,
			`SELECT core.cfg_iso_pub_get('guest_ttl_days')`,
		);
		assert.equal(cfg[0]?.cfg_iso_pub_get, 7);
		results.push({
			check: "config allow-list + SECURITY DEFINER get/upsert",
			result: "pass",
		});
		await client.query("ROLLBACK");

		const timeoutRows = await queryRows<{ rolconfig: string[] | null }>(
			client,
			`SELECT rolconfig FROM pg_roles WHERE rolname = 'mod_iso_pub'`,
		);
		assert.ok(
			(timeoutRows[0]?.rolconfig ?? []).some(
				(entry) => entry === `statement_timeout=${STATEMENT_TIMEOUT_MS}`,
			),
		);
		results.push({
			check: "statement_timeout bound on module role",
			result: "pass",
		});

		const version = await queryRows<{ version: string }>(
			client,
			`SELECT version()`,
		);
		// biome-ignore lint/suspicious/noConsole: proof script emits JSON evidence to stdout.
		console.log(
			JSON.stringify(
				{
					ok: true,
					startedAt,
					finishedAt: new Date().toISOString(),
					containerName,
					postgresVersion: version[0]?.version ?? "unknown",
					port,
					curatedModules: curated.length,
					curatedRelational: curatedRelational.length,
					checks: results,
				},
				null,
				2,
			),
		);
	} finally {
		client.release();
		await pool.end();
		cleanupContainer();
	}
}

main().catch((error) => {
	// biome-ignore lint/suspicious/noConsole: proof script reports fatal failures.
	console.error(error);
	cleanupContainer();
	process.exit(1);
});
