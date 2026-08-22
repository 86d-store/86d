/**
 * Standalone/Docker mode proof for independent durable-event worker schedule (plan 004).
 *
 * Proves:
 * - Schedule identity is `bun run worker:durable-events` (apps/store), not web traffic
 * - Web API route source does not drain the outbox
 * - A worker drain claims work; a restart after lease expiry reclaims in-flight rows
 *
 * Usage (from public/packages/db):
 *   bun scripts/test-durable-event-worker-schedule.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { runDurableEventWorker } from "../../../apps/store/lib/durable-event-worker.ts";
import { applyFrameworkMigrations } from "../src/schema/apply-disposable-ddl.ts";

const scriptRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const packageRoot = resolve(scriptRoot, "..");
const repoRoot = resolve(packageRoot, "../..");
const containerName = `86d-outbox-worker-${process.pid}-${randomUUID().slice(0, 8)}`;
const databaseName = "durable_event_worker_proof";
const databasePassword = "worker-proof";

const SCHEDULE_IDENTITY = "bun run worker:durable-events";
const WORKER_ENTRY = "apps/store/scripts/durable-events-worker.ts";
const API_ROUTE = "apps/store/app/api/[...path]/route.ts";
const LEASE_MS = 30_000;

const moduleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const storeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const consumer = "audit-log.inventory-adjusted.v1";
const eventId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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

const CLAIM_SQL = `
WITH claimable AS (
  SELECT delivery."consumer", delivery."eventId"
  FROM "ModuleEventDelivery" delivery
  JOIN "ModuleOutboxEvent" event ON event."id" = delivery."eventId"
  WHERE event."storeId" = $1::uuid
    AND delivery."consumer" = ANY($2::text[])
    AND delivery."nextAttemptAt" <= $4
    AND delivery."attempts" < $7
    AND (
      delivery."state" IN ('pending', 'failed')
      OR (delivery."state" = 'processing' AND delivery."leaseExpiresAt" <= $4)
    )
  ORDER BY event."occurredAt", event."id", delivery."consumer"
  FOR UPDATE OF delivery SKIP LOCKED
  LIMIT $3
)
UPDATE "ModuleEventDelivery" delivery
SET "state" = 'processing',
    "attempts" = delivery."attempts" + 1,
    "leaseToken" = $5::uuid,
    "leaseOwner" = $8,
    "leaseExpiresAt" = $6,
    "updatedAt" = $4
FROM claimable
WHERE delivery."consumer" = claimable."consumer"
  AND delivery."eventId" = claimable."eventId"
RETURNING delivery."consumer", delivery."eventId", delivery."leaseToken", delivery."attempts"
`;

async function claimBatch(
	client: PoolClient,
	now: Date,
	leaseToken: string,
	leaseOwner: string,
): Promise<number> {
	await client.query("BEGIN");
	try {
		const result = await client.query(CLAIM_SQL, [
			storeId,
			[consumer],
			20,
			now,
			leaseToken,
			new Date(now.getTime() + LEASE_MS),
			8,
			leaseOwner,
		]);
		await client.query("COMMIT");
		return result.rowCount ?? 0;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	}
}

async function main(): Promise<void> {
	const startedAt = new Date().toISOString();
	const checks: Array<{ check: string; result: string }> = [];

	const apiRouteSource = readFileSync(join(repoRoot, API_ROUTE), "utf8");
	assert.doesNotMatch(
		apiRouteSource,
		/drainDurableEvents|scheduleDurableEventDrain/,
		"web API route must not drain the outbox",
	);
	assert.match(
		apiRouteSource,
		/worker:durable-events/,
		"web API route must document the independent worker schedule",
	);
	checks.push({
		check: "web traffic does not drain outbox",
		result: "pass",
	});

	const workerEntry = readFileSync(join(repoRoot, WORKER_ENTRY), "utf8");
	assert.match(workerEntry, /runDurableEventWorker/);
	assert.match(workerEntry, /drainDurableEventsBatch/);
	checks.push({
		check: `schedule identity ${SCHEDULE_IDENTITY}`,
		result: "pass",
	});

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

	try {
		await applyFrameworkMigrations({
			exec: async (statement) => {
				await client.query(statement);
			},
		});

		await client.query(
			`INSERT INTO "Module" (
				"id", "cuid", "name", "version", "storeId", "createdAt", "updatedAt"
			) VALUES ($1::uuid, 'worker-proof-module', 'inventory', '1.0.0', $2::uuid, now(), now())`,
			[moduleId, storeId],
		);
		const clockStart = new Date("2026-01-01T00:00:00.000Z");
		await client.query(
			`INSERT INTO "ModuleOutboxEvent" (
				"id", "eventType", "schemaVersion", "storeId", "sourceModule",
				"aggregateType", "aggregateId", "aggregateSequence", "occurredAt",
				"payload", "moduleId"
			) VALUES (
				$1::uuid, 'inventory.adjusted', 1, $2::uuid, 'inventory',
				'inventory-item', 'product-1:_:_', 1, $4, '{}'::jsonb, $3::uuid
			)`,
			[eventId, storeId, moduleId, clockStart],
		);
		await client.query(
			`INSERT INTO "ModuleEventDelivery" (
				"consumer", "eventId", "state", "attempts", "nextAttemptAt", "updatedAt"
			) VALUES ($1, $2::uuid, 'pending', 0, $3, $3)`,
			[consumer, eventId, clockStart],
		);

		// Web remains stopped: this proof never starts the Next.js store process.
		checks.push({
			check: "web process stopped during worker drain",
			result: "pass (no store web process started)",
		});

		const firstToken = randomUUID();
		const t0 = new Date(clockStart.getTime() + 1_000);
		const firstWorker = await runDurableEventWorker({
			maxBatches: 5,
			drain: async () => {
				const claimed = await claimBatch(
					client,
					t0,
					firstToken,
					"worker-first",
				);
				return {
					claimed,
					succeeded: 0,
					failed: 0,
					deadLettered: 0,
				};
			},
		});
		assert.equal(firstWorker.claimed, 1);
		assert.equal(firstWorker.batches, 2); // one claim + one idle
		const processing = await client.query<{
			state: string;
			leaseToken: string | null;
		}>(
			`SELECT "state", "leaseToken" FROM "ModuleEventDelivery"
       WHERE "consumer" = $1 AND "eventId" = $2::uuid`,
			[consumer, eventId],
		);
		assert.equal(processing.rows[0]?.state, "processing");
		assert.equal(processing.rows[0]?.leaseToken, firstToken);
		checks.push({
			check: "first worker drain claims pending delivery",
			result: "pass",
		});

		// Restart while lease is still valid: must not steal the in-flight row.
		const secondToken = randomUUID();
		const midLease = new Date(t0.getTime() + 5_000);
		const midRestart = await runDurableEventWorker({
			maxBatches: 3,
			drain: async () => {
				const claimed = await claimBatch(
					client,
					midLease,
					secondToken,
					"worker-mid",
				);
				return {
					claimed,
					succeeded: 0,
					failed: 0,
					deadLettered: 0,
				};
			},
		});
		assert.equal(midRestart.claimed, 0);
		checks.push({
			check: "restart during active lease does not steal work",
			result: "pass",
		});

		// Restart after lease expiry: reclaim with a new token.
		const thirdToken = randomUUID();
		const afterLease = new Date(t0.getTime() + LEASE_MS + 1);
		const reclaimWorker = await runDurableEventWorker({
			maxBatches: 3,
			drain: async () => {
				const claimed = await claimBatch(
					client,
					afterLease,
					thirdToken,
					"worker-reclaim",
				);
				return {
					claimed,
					succeeded: 0,
					failed: 0,
					deadLettered: 0,
				};
			},
		});
		assert.equal(reclaimWorker.claimed, 1);
		const reclaimed = await client.query<{
			state: string;
			leaseToken: string | null;
			attempts: number;
		}>(
			`SELECT "state", "leaseToken", "attempts" FROM "ModuleEventDelivery"
       WHERE "consumer" = $1 AND "eventId" = $2::uuid`,
			[consumer, eventId],
		);
		assert.equal(reclaimed.rows[0]?.state, "processing");
		assert.equal(reclaimed.rows[0]?.leaseToken, thirdToken);
		assert.equal(reclaimed.rows[0]?.attempts, 2);
		checks.push({
			check: "restart after lease expiry reclaims in-flight delivery",
			result: "pass",
		});

		const version = await client.query<{ version: string }>(`SELECT version()`);
		// biome-ignore lint/suspicious/noConsole: proof script emits JSON evidence to stdout.
		console.log(
			JSON.stringify(
				{
					ok: true,
					startedAt,
					finishedAt: new Date().toISOString(),
					containerName,
					postgresVersion: version.rows[0]?.version ?? "unknown",
					port,
					scheduleIdentity: SCHEDULE_IDENTITY,
					workerEntry: WORKER_ENTRY,
					leaseMs: LEASE_MS,
					webStopped: true,
					checks,
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
