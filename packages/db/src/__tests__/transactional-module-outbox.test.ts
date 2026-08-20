import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationsDirectory = resolve(
	import.meta.dirname,
	"../../prisma/migrations",
);
const moduleId = "11111111-1111-4111-8111-111111111111";
const storeId = "22222222-2222-4222-8222-222222222222";
let database: PGlite;

beforeAll(async () => {
	database = new PGlite({ extensions: { pgcrypto } });
	for (const migration of readdirSync(migrationsDirectory, {
		withFileTypes: true,
	})
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()) {
		await database.exec(
			readFileSync(
				resolve(migrationsDirectory, migration, "migration.sql"),
				"utf8",
			),
		);
	}

	await database.query(
		`INSERT INTO "Module" (
			"id", "cuid", "name", "version", "storeId", "createdAt", "updatedAt"
		) VALUES ($1::uuid, 'outbox-test-module', 'inventory', '1.0.0', $2::uuid, now(), now())`,
		[moduleId, storeId],
	);
}, 15_000);

afterAll(async () => {
	await database.close();
});

async function inRollback(work: () => Promise<void>): Promise<void> {
	await database.exec("BEGIN");
	try {
		await work();
	} finally {
		await database.exec("ROLLBACK");
	}
}

async function insertEvent(options?: {
	id?: string;
	aggregateId?: string;
	aggregateSequence?: number;
}): Promise<void> {
	await database.query(
		`INSERT INTO "ModuleOutboxEvent" (
			"id", "eventType", "schemaVersion", "storeId", "sourceModule",
			"aggregateType", "aggregateId", "aggregateSequence", "occurredAt",
			"payload", "moduleId"
		) VALUES (
			$1::uuid, 'inventory.adjusted', 1, $2::uuid, 'inventory',
			'inventory-item', $3, $4, now(), '{}'::jsonb, $5::uuid
		)`,
		[
			options?.id ?? "33333333-3333-4333-8333-333333333333",
			storeId,
			options?.aggregateId ?? "product-1:_:_",
			options?.aggregateSequence ?? 1,
			moduleId,
		],
	);
}

describe("transactional Module outbox migration", () => {
	it("keeps aggregate ordering local while rejecting duplicate sequence identities", async () => {
		await inRollback(async () => {
			await insertEvent();
			await insertEvent({
				id: "44444444-4444-4444-8444-444444444444",
				aggregateId: "product-2:_:_",
			});

			await expect(
				insertEvent({ id: "55555555-5555-4555-8555-555555555555" }),
			).rejects.toThrow(/unique|duplicate/i);
		});
	});

	it("rejects invalid event, sequence, and delivery lifecycle states", async () => {
		await inRollback(async () => {
			await expect(
				database.query(
					`INSERT INTO "ModuleEventSequence" (
						"storeId", "sourceModule", "aggregateType", "aggregateId", "lastSequence"
					) VALUES ($1::uuid, '', 'inventory-item', 'product-1:_:_', 1)`,
					[storeId],
				),
			).rejects.toThrow(/check constraint/i);
		});

		await inRollback(async () => {
			await expect(
				database.query(
					`INSERT INTO "ModuleEventSequence" (
						"storeId", "sourceModule", "aggregateType", "aggregateId", "lastSequence"
					) VALUES (
						$1::uuid, 'inventory', 'inventory-item', 'product-1:_:_',
						9007199254740992
					)`,
					[storeId],
				),
			).rejects.toThrow(/check constraint/i);
		});

		await inRollback(async () => {
			await expect(
				database.query(
					`INSERT INTO "ModuleOutboxEvent" (
						"id", "eventType", "schemaVersion", "storeId", "sourceModule",
						"aggregateType", "aggregateId", "aggregateSequence", "occurredAt",
						"payload", "moduleId"
					) VALUES (
						'77777777-7777-4777-8777-777777777777', 'inventory.adjusted',
						1, $1::uuid, 'inventory', 'inventory-item', 'product-1:_:_',
						9007199254740992, now(), '{}'::jsonb, $2::uuid
					)`,
					[storeId, moduleId],
				),
			).rejects.toThrow(/check constraint/i);
		});

		await inRollback(async () => {
			await insertEvent();
			await expect(
				database.query(
					`INSERT INTO "ModuleEventDelivery" (
						"eventId", "consumer", "state", "attempts", "nextAttemptAt",
						"leaseToken", "leaseOwner", "leaseExpiresAt"
					) VALUES (
						'33333333-3333-4333-8333-333333333333',
						'audit-log.inventory-adjusted.v1', 'processing', 1, now(),
						'66666666-6666-4666-8666-666666666666', NULL, now() + interval '30 seconds'
					)`,
				),
			).rejects.toThrow(/check constraint/i);
		});

		await inRollback(async () => {
			await insertEvent();
			await expect(
				database.query(
					`INSERT INTO "ModuleEventDelivery" (
						"eventId", "consumer", "state", "attempts", "nextAttemptAt", "lastError"
					) VALUES (
						'33333333-3333-4333-8333-333333333333',
						'audit-log.inventory-adjusted.v1', 'failed', 1, now(), '   '
					)`,
				),
			).rejects.toThrow(/check constraint/i);
		});
	});

	it("deduplicates consumers and RESTRICTs every durable ownership edge", async () => {
		await inRollback(async () => {
			await expect(
				database.query(
					`INSERT INTO "ModuleOutboxEvent" (
						"id", "eventType", "schemaVersion", "storeId", "sourceModule",
						"aggregateType", "aggregateId", "aggregateSequence", "occurredAt",
						"payload", "moduleId"
					) VALUES (
						'88888888-8888-4888-8888-888888888888', 'inventory.adjusted',
						1, $1::uuid, 'products', 'inventory-item', 'product-1:_:_',
						1, now(), '{}'::jsonb, $2::uuid
					)`,
					[storeId, moduleId],
				),
			).rejects.toThrow(/foreign key constraint/i);
		});

		await inRollback(async () => {
			await insertEvent();
			await database.query(
				`INSERT INTO "ModuleEventDelivery" (
					"eventId", "consumer", "state", "attempts", "nextAttemptAt"
				) VALUES (
					'33333333-3333-4333-8333-333333333333',
					'audit-log.inventory-adjusted.v1', 'pending', 0, now()
				)`,
			);
			await expect(
				database.query(
					`INSERT INTO "ModuleEventDelivery" (
						"eventId", "consumer", "state", "attempts", "nextAttemptAt"
					) VALUES (
						'33333333-3333-4333-8333-333333333333',
						'audit-log.inventory-adjusted.v1', 'pending', 0, now()
					)`,
				),
			).rejects.toThrow(/unique|duplicate/i);
		});

		await inRollback(async () => {
			await insertEvent();
			await database.query(
				`INSERT INTO "ModuleEventDelivery" (
					"eventId", "consumer", "state", "attempts", "nextAttemptAt"
				) VALUES (
					'33333333-3333-4333-8333-333333333333',
					'audit-log.inventory-adjusted.v1', 'pending', 0, now()
				)`,
			);
			await database.query(
				`INSERT INTO "ModuleEventConsumption" ("consumer", "eventId")
				 VALUES (
					'audit-log.inventory-adjusted.v1',
					'33333333-3333-4333-8333-333333333333'
				 )`,
			);

			await expect(
				database.query(
					`DELETE FROM "ModuleEventDelivery"
					 WHERE "consumer" = 'audit-log.inventory-adjusted.v1'
					   AND "eventId" = '33333333-3333-4333-8333-333333333333'`,
				),
			).rejects.toThrow(/foreign key constraint/i);
		});

		await inRollback(async () => {
			await insertEvent();
			await expect(
				database.query(`DELETE FROM "Module" WHERE "id" = $1::uuid`, [
					moduleId,
				]),
			).rejects.toThrow(/foreign key constraint/i);
		});
	});

	it("accepts a terminal dead letter only with a released lease and a reason", async () => {
		await inRollback(async () => {
			await insertEvent();
			await database.query(
				`INSERT INTO "ModuleEventDelivery" (
					"eventId", "consumer", "state", "attempts", "nextAttemptAt", "lastError"
				) VALUES (
					'33333333-3333-4333-8333-333333333333',
					'audit-log.inventory-adjusted.v1', 'dead_letter', 3, now(),
					'EVENT_ATTEMPTS_EXHAUSTED'
				)`,
			);
			const stored = await database.query<{ state: string; attempts: number }>(
				`SELECT "state", "attempts" FROM "ModuleEventDelivery"`,
			);
			expect(stored.rows[0]).toMatchObject({
				state: "dead_letter",
				attempts: 3,
			});
		});

		// A terminal delivery must carry its reason.
		await inRollback(async () => {
			await insertEvent();
			await expect(
				database.query(
					`INSERT INTO "ModuleEventDelivery" (
						"eventId", "consumer", "state", "attempts", "nextAttemptAt"
					) VALUES (
						'33333333-3333-4333-8333-333333333333',
						'audit-log.inventory-adjusted.v1', 'dead_letter', 3, now()
					)`,
				),
			).rejects.toThrow(/check constraint/i);
		});

		// A terminal delivery must not still hold a lease.
		await inRollback(async () => {
			await insertEvent();
			await expect(
				database.query(
					`INSERT INTO "ModuleEventDelivery" (
						"eventId", "consumer", "state", "attempts", "nextAttemptAt",
						"lastError", "leaseToken", "leaseOwner", "leaseExpiresAt"
					) VALUES (
						'33333333-3333-4333-8333-333333333333',
						'audit-log.inventory-adjusted.v1', 'dead_letter', 3, now(),
						'EVENT_ATTEMPTS_EXHAUSTED',
						'66666666-6666-4666-8666-666666666666', 'worker-1',
						now() + interval '30 seconds'
					)`,
				),
			).rejects.toThrow(/check constraint/i);
		});

		// A terminal delivery never reads as delivered.
		await inRollback(async () => {
			await insertEvent();
			await expect(
				database.query(
					`INSERT INTO "ModuleEventDelivery" (
						"eventId", "consumer", "state", "attempts", "nextAttemptAt",
						"lastError", "succeededAt"
					) VALUES (
						'33333333-3333-4333-8333-333333333333',
						'audit-log.inventory-adjusted.v1', 'dead_letter', 3, now(),
						'EVENT_ATTEMPTS_EXHAUSTED', now()
					)`,
				),
			).rejects.toThrow(/check constraint/i);
		});
	});

	it("installs targeted claim, stale-lease, and aggregate-order indexes", async () => {
		const result = await database.query<{
			indexname: string;
			indexdef: string;
		}>(`
			SELECT indexname, indexdef
			FROM pg_indexes
			WHERE schemaname = 'public'
			  AND indexname IN (
				'ModuleEventDelivery_claimable_idx',
				'ModuleEventDelivery_stale_lease_idx',
				'ModuleOutboxEvent_aggregate_order_key'
			  )
			ORDER BY indexname
		`);

		expect(result.rows.map((row) => row.indexname)).toEqual([
			"ModuleEventDelivery_claimable_idx",
			"ModuleEventDelivery_stale_lease_idx",
			"ModuleOutboxEvent_aggregate_order_key",
		]);
		expect(
			result.rows.find(
				(row) => row.indexname === "ModuleEventDelivery_claimable_idx",
			)?.indexdef,
		).toMatch(/WHERE.*state.*pending.*failed/i);
		expect(
			result.rows.find(
				(row) => row.indexname === "ModuleEventDelivery_stale_lease_idx",
			)?.indexdef,
		).toMatch(/WHERE.*state.*processing/i);
	});
});
