import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { col } from "@86d-app/core/schema/col";
import {
	compileModuleDeclarations,
	emitSql,
} from "@86d-app/core/schema/compile";
import type { Module } from "@86d-app/core/types/module";
import { z } from "@86d-app/core/zod";
import { Pool, type PoolClient } from "pg";
import {
	applyModuleDdl,
	createPostgresTransactionalExecutor,
} from "../src/schema/apply-disposable-ddl.ts";

const containerName = `86d-module-ddl-race-${process.pid}-${randomUUID().slice(0, 8)}`;
const databaseName = "module_ddl_race";
const databasePassword = "module-ddl-race-proof";
const concurrentCallers = 8;

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
		// The disposable container may already have exited.
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

function compiledModuleSql(): string {
	const module: Module = {
		id: "ddl-race",
		version: "1.0.0",
		storage: {
			kind: "relational",
			tables: {
				record: {
					shape: z.object({
						id: z.string().register(col, { pk: true }),
						value: z.string(),
					}),
				},
			},
		},
	};
	return emitSql(compileModuleDeclarations([module]).transcoded);
}

async function waitForPostgres(): Promise<void> {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		try {
			docker([
				"exec",
				containerName,
				"pg_isready",
				"--host",
				"127.0.0.1",
				"--username",
				"postgres",
				"--dbname",
				databaseName,
			]);
			return;
		} catch {
			await Bun.sleep(250);
		}
	}
	throw new Error("PostgreSQL container did not become ready.");
}

async function runConcurrentApply(
	clients: readonly PoolClient[],
): Promise<void> {
	let arrivals = 0;
	let release: (() => void) | undefined;
	const allArrived = new Promise<void>((resolve) => {
		release = resolve;
	});

	await Promise.all(
		clients.map(async (client) => {
			let firstStatement = true;
			const exec = async (statement: string) => {
				if (firstStatement) {
					firstStatement = false;
					arrivals += 1;
					if (arrivals === clients.length) release?.();
					await allArrived;
				}
				await client.query(statement);
			};
			await applyModuleDdl(
				{
					exec,
					async transaction<T>(
						run: (executor: { exec: typeof exec }) => Promise<T>,
					) {
						await client.query("BEGIN");
						try {
							const result = await run({ exec });
							await client.query("COMMIT");
							return result;
						} catch (error) {
							await client.query("ROLLBACK");
							throw error;
						}
					},
				},
				compiledModuleSql(),
			);
		}),
	);
}

async function main(): Promise<void> {
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
	await waitForPostgres();

	const portOutput = docker(["port", containerName, "5432/tcp"]).trim();
	const port = /:(\d+)$/.exec(portOutput)?.[1];
	assert.ok(port, `Could not resolve PostgreSQL port from ${portOutput}`);

	const pool = new Pool({
		connectionString: `postgresql://postgres:${databasePassword}@127.0.0.1:${port}/${databaseName}`,
		max: concurrentCallers * 2,
	});
	const clients = await Promise.all(
		Array.from({ length: concurrentCallers }, () => pool.connect()),
	);

	try {
		await runConcurrentApply(clients);
		let result = await clients[0].query<{ table_name: string }>(
			`SELECT table_name FROM information_schema.tables
			 WHERE table_schema = 'mod_ddl-race' AND table_name = 'record'`,
		);
		assert.deepEqual(result.rows, [{ table_name: "record" }]);

		await clients[0].query(`DROP SCHEMA "mod_ddl-race" CASCADE`);
		const productionExecutor = createPostgresTransactionalExecutor(pool);
		await Promise.all(
			Array.from({ length: concurrentCallers }, () =>
				applyModuleDdl(productionExecutor, compiledModuleSql()),
			),
		);
		result = await clients[0].query<{ table_name: string }>(
			`SELECT table_name FROM information_schema.tables
			 WHERE table_schema = 'mod_ddl-race' AND table_name = 'record'`,
		);
		assert.deepEqual(result.rows, [{ table_name: "record" }]);
	} finally {
		for (const client of clients) client.release();
		await pool.end();
		cleanupContainer();
	}

	// biome-ignore lint/suspicious/noConsole: proof scripts report their single result.
	console.log("concurrent Module DDL apply: pass");
}

await main();
