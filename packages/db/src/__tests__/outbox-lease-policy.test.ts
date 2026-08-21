import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyFrameworkMigrations } from "../schema/apply-disposable-ddl";

const moduleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const storeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const consumer = "audit-log.inventory-adjusted.v1";
let database: PGlite;

beforeAll(async () => {
	database = new PGlite({ extensions: { pgcrypto } });
	await applyFrameworkMigrations({
		exec: async (statement) => {
			await database.exec(statement);
		},
	});
	await database.query(
		`INSERT INTO "Module" (
			"id", "cuid", "name", "version", "storeId", "createdAt", "updatedAt"
		) VALUES ($1::uuid, 'lease-test-module', 'inventory', '1.0.0', $2::uuid, now(), now())`,
		[moduleId, storeId],
	);
}, 30_000);

afterAll(async () => {
	await database.close();
});

async function insertEvent(options: {
	id: string;
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
			options.id,
			storeId,
			options.aggregateId ?? "product-1:_:_",
			options.aggregateSequence ?? 1,
			moduleId,
		],
	);
}

/** Claim SQL excerpt matching DurableEventDispatcher (SKIP LOCKED + 30s lease). */
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
    AND NOT EXISTS (
      SELECT 1
      FROM "ModuleEventDelivery" prior
      JOIN "ModuleOutboxEvent" prior_event ON prior_event."id" = prior."eventId"
      WHERE prior."consumer" = delivery."consumer"
        AND prior_event."storeId" = event."storeId"
        AND prior_event."sourceModule" = event."sourceModule"
        AND prior_event."aggregateType" = event."aggregateType"
        AND prior_event."aggregateId" = event."aggregateId"
        AND prior_event."aggregateSequence" < event."aggregateSequence"
        AND prior."state" NOT IN ('succeeded', 'skipped')
    )
  ORDER BY event."occurredAt", event."id", delivery."consumer"
  FOR UPDATE OF delivery SKIP LOCKED
  LIMIT $3
)
UPDATE "ModuleEventDelivery" delivery
SET "state" = 'processing',
    "attempts" = delivery."attempts" + 1,
    "leaseToken" = gen_random_uuid(),
    "leaseExpiresAt" = $5,
    "leaseOwner" = $6,
    "updatedAt" = $4
FROM claimable
WHERE delivery."consumer" = claimable."consumer"
  AND delivery."eventId" = claimable."eventId"
RETURNING delivery."eventId", delivery."consumer", delivery."leaseToken",
          delivery."leaseOwner", delivery."attempts", delivery."leaseExpiresAt"
`;

describe("real-PostgreSQL outbox lease, backoff, and dead-letter policy", () => {
	it("excludes concurrent claims with FOR UPDATE SKIP LOCKED", async () => {
		await database.exec("BEGIN");
		try {
			const eventId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
			await insertEvent({ id: eventId });
			await database.query(
				`INSERT INTO "ModuleEventDelivery" (
					"eventId", "consumer", "state", "attempts", "nextAttemptAt"
				) VALUES ($1::uuid, $2, 'pending', 0, now())`,
				[eventId, consumer],
			);

			const now = new Date();
			const leaseExpires = new Date(now.getTime() + 30_000);
			const first = await database.query(CLAIM_SQL, [
				storeId,
				[consumer],
				10,
				now,
				leaseExpires,
				"worker-a",
				8,
			]);
			expect(first.rows).toHaveLength(1);

			const second = await database.query(CLAIM_SQL, [
				storeId,
				[consumer],
				10,
				now,
				leaseExpires,
				"worker-b",
				8,
			]);
			expect(second.rows).toHaveLength(0);
		} finally {
			await database.exec("ROLLBACK");
		}
	});

	it("rejects stale-token completion and reclaims after 30 seconds", async () => {
		await database.exec("BEGIN");
		try {
			const eventId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
			await insertEvent({ id: eventId });
			const leaseToken = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
			const staleToken = "ffffffff-ffff-4fff-8fff-ffffffffffff";
			const now = new Date();
			await database.query(
				`INSERT INTO "ModuleEventDelivery" (
					"eventId", "consumer", "state", "attempts", "nextAttemptAt",
					"leaseToken", "leaseOwner", "leaseExpiresAt"
				) VALUES (
					$1::uuid, $2, 'processing', 1, $3,
					$4::uuid, 'worker-a', $5
				)`,
				[eventId, consumer, now, leaseToken, new Date(now.getTime() + 30_000)],
			);

			const staleAck = await database.query(
				`UPDATE "ModuleEventDelivery"
				 SET "state" = 'succeeded', "succeededAt" = $1,
				     "leaseToken" = NULL, "leaseOwner" = NULL, "leaseExpiresAt" = NULL
				 WHERE "consumer" = $2 AND "eventId" = $3::uuid
				   AND "state" = 'processing' AND "leaseToken" = $4::uuid
				 RETURNING "eventId"`,
				[now, consumer, eventId, staleToken],
			);
			expect(staleAck.rows).toHaveLength(0);

			const reclaimNow = new Date(now.getTime() + 31_000);
			const reclaimed = await database.query(CLAIM_SQL, [
				storeId,
				[consumer],
				10,
				reclaimNow,
				new Date(reclaimNow.getTime() + 30_000),
				"worker-b",
				8,
			]);
			expect(reclaimed.rows).toHaveLength(1);
			expect(Number((reclaimed.rows[0] as { attempts: number }).attempts)).toBe(
				2,
			);
		} finally {
			await database.exec("ROLLBACK");
		}
	});

	it("blocks head-of-line until dead letter is retried or skipped", async () => {
		await database.exec("BEGIN");
		try {
			const firstId = "11111111-1111-4111-8111-111111111111";
			const secondId = "22222222-2222-4222-8222-222222222222";
			await insertEvent({ id: firstId, aggregateSequence: 1 });
			await insertEvent({ id: secondId, aggregateSequence: 2 });
			await database.query(
				`INSERT INTO "ModuleEventDelivery" (
					"eventId", "consumer", "state", "attempts", "nextAttemptAt", "lastError"
				) VALUES ($1::uuid, $2, 'dead_letter', 8, now(), 'EVENT_ATTEMPTS_EXHAUSTED')`,
				[firstId, consumer],
			);
			await database.query(
				`INSERT INTO "ModuleEventDelivery" (
					"eventId", "consumer", "state", "attempts", "nextAttemptAt"
				) VALUES ($1::uuid, $2, 'pending', 0, now())`,
				[secondId, consumer],
			);

			const now = new Date();
			const blocked = await database.query(CLAIM_SQL, [
				storeId,
				[consumer],
				10,
				now,
				new Date(now.getTime() + 30_000),
				"worker-a",
				8,
			]);
			expect(blocked.rows).toHaveLength(0);

			await database.query(
				`UPDATE "ModuleEventDelivery"
				 SET "state" = 'skipped', "succeededAt" = $1, "lastError" = 'SKIP:operator'
				 WHERE "eventId" = $2::uuid AND "consumer" = $3`,
				[now, firstId, consumer],
			);

			const unblocked = await database.query(CLAIM_SQL, [
				storeId,
				[consumer],
				10,
				now,
				new Date(now.getTime() + 30_000),
				"worker-a",
				8,
			]);
			expect(unblocked.rows).toHaveLength(1);
			expect((unblocked.rows[0] as { eventId: string }).eventId).toBe(secondId);
		} finally {
			await database.exec("ROLLBACK");
		}
	});

	it("accepts skipped terminal with audited reason and allows retry generation", async () => {
		await database.exec("BEGIN");
		try {
			const eventId = "33333333-3333-4333-8333-333333333333";
			await insertEvent({ id: eventId });
			await database.query(
				`INSERT INTO "ModuleEventDelivery" (
					"eventId", "consumer", "state", "attempts", "nextAttemptAt", "lastError"
				) VALUES ($1::uuid, $2, 'dead_letter', 8, now(), 'EVENT_ATTEMPTS_EXHAUSTED')`,
				[eventId, consumer],
			);

			await database.query(
				`UPDATE "ModuleEventDelivery"
				 SET "state" = 'pending', "attempts" = 0, "nextAttemptAt" = now(),
				     "lastError" = NULL, "succeededAt" = NULL
				 WHERE "eventId" = $1::uuid AND "consumer" = $2 AND "state" = 'dead_letter'`,
				[eventId, consumer],
			);
			const retried = await database.query(
				`SELECT "state", "attempts", "lastError" FROM "ModuleEventDelivery"
				 WHERE "eventId" = $1::uuid`,
				[eventId],
			);
			expect(retried.rows[0]).toMatchObject({
				state: "pending",
				attempts: 0,
				lastError: null,
			});
		} finally {
			await database.exec("ROLLBACK");
		}
	});
});
