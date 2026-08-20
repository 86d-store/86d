import type {
	AnyDurableEventConsumer,
	DurableEventEnvelope,
} from "@86d-app/core/durable-events";
import type { ModuleDataService } from "@86d-app/core/types/module";

interface ClaimedDelivery {
	eventId: string;
	consumer: string;
	leaseToken: string;
	leaseOwner: string;
	eventType: string;
	schemaVersion: number;
	storeId: string;
	sourceModule: string;
	aggregateType: string;
	aggregateId: string;
	aggregateSequence: bigint;
	occurredAt: Date;
	payload: unknown;
	attempts: number;
}

interface DispatcherConfig {
	// biome-ignore lint/suspicious/noExplicitAny: persistence client is kept behind this adapter
	db: any;
	storeId: string;
	consumers: readonly AnyDurableEventConsumer[];
	/**
	 * Attempts a single delivery may make before it becomes terminal. Reaching
	 * the bound moves the delivery to `dead_letter`; it is never claimed again
	 * and it deliberately holds later events for the same aggregate so nothing
	 * is applied out of order.
	 */
	maxAttempts?: number | undefined;
	getConsumerData: (
		moduleId: string,
		// biome-ignore lint/suspicious/noExplicitAny: generated transaction client is adapter-private
		transaction: any,
	) => ModuleDataService;
}

export interface DrainDurableEventsOptions {
	limit: number;
	leaseDurationMs?: number | undefined;
	now?: Date | undefined;
}

export interface DrainDurableEventsResult {
	claimed: number;
	succeeded: number;
	failed: number;
	/** Deliveries that became terminal during this drain. */
	deadLettered: number;
}

/** Default attempt budget for one delivery before it becomes terminal. */
const DEFAULT_MAX_ATTEMPTS = 8;

class DeliveryFailure extends Error {
	readonly code: string;

	constructor(code: string) {
		super(code);
		this.code = code;
	}
}

function boundedLimit(limit: number): number {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
		throw new Error("Durable event drain limit must be between 1 and 100.");
	}
	return limit;
}

function boundedLease(milliseconds: number): number {
	if (
		!Number.isSafeInteger(milliseconds) ||
		milliseconds < 1_000 ||
		milliseconds > 300_000
	) {
		throw new Error("Durable event lease must be between 1 and 300 seconds.");
	}
	return milliseconds;
}

function boundedAttempts(attempts: number): number {
	if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 50) {
		throw new Error("Durable event attempt budget must be between 1 and 50.");
	}
	return attempts;
}

function retryDelay(attempts: number): number {
	return Math.min(60_000, 1_000 * 2 ** Math.min(6, Math.max(0, attempts - 1)));
}

function failureCode(error: unknown): string {
	return error instanceof DeliveryFailure
		? error.code.slice(0, 500)
		: "DURABLE_EVENT_HANDLER_FAILED";
}

/**
 * Explicit, bounded durable-event delivery. No timer or background process is
 * created; callers choose when to drain.
 */
export class DurableEventDispatcher {
	private readonly config: DispatcherConfig;
	private readonly consumersById: Map<string, AnyDurableEventConsumer>;
	private readonly maxAttempts: number;

	constructor(config: DispatcherConfig) {
		this.config = config;
		this.maxAttempts = boundedAttempts(
			config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
		);
		this.consumersById = new Map();
		for (const consumer of config.consumers) {
			if (this.consumersById.has(consumer.consumer)) {
				throw new Error(
					`Duplicate durable event consumer "${consumer.consumer}".`,
				);
			}
			if (consumer.owner.length === 0 || consumer.consumer.length > 200) {
				throw new Error("Durable event consumer identity is invalid.");
			}
			this.consumersById.set(consumer.consumer, consumer);
		}
	}

	async drain(
		options: DrainDurableEventsOptions,
	): Promise<DrainDurableEventsResult> {
		const limit = boundedLimit(options.limit);
		const leaseDurationMs = boundedLease(options.leaseDurationMs ?? 30_000);
		const now = options.now ?? new Date();
		const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
		const leaseOwner = crypto.randomUUID();
		const consumers = [...this.consumersById.keys()].sort();
		if (consumers.length === 0) {
			return { claimed: 0, succeeded: 0, failed: 0, deadLettered: 0 };
		}

		const registrations = consumers.map((identity) => {
			const consumer = this.consumersById.get(identity);
			if (!consumer) throw new Error("Durable event consumer disappeared.");
			return {
				consumer: identity,
				owner: consumer.definition.owner,
				eventType: consumer.definition.name,
				schemaVersion: consumer.definition.version,
			};
		});

		// Three explicit statements. Materialization and the claim cannot share
		// one statement: every CTE reads the snapshot taken when the statement
		// began, so a claim CTE can never see rows a sibling CTE just inserted
		// and a newly registered consumer would wait a whole extra drain.
		await this.config.db.$queryRawUnsafe(
			MATERIALIZE_SQL,
			this.config.storeId,
			limit,
			now,
			JSON.stringify(registrations),
		);

		const deadLettered = (await this.config.db.$queryRawUnsafe(
			DEAD_LETTER_SQL,
			this.config.storeId,
			consumers,
			limit,
			now,
			this.maxAttempts,
		)) as Array<{ eventId: string }>;
		await this.markExhaustedEvents(deadLettered, now);

		const claimed = (await this.config.db.$queryRawUnsafe(
			CLAIM_SQL,
			this.config.storeId,
			consumers,
			limit,
			now,
			leaseExpiresAt,
			leaseOwner,
			this.maxAttempts,
		)) as ClaimedDelivery[];

		let succeeded = 0;
		let failed = 0;
		let terminal = deadLettered.length;
		for (const delivery of claimed) {
			const outcome = await this.deliver(delivery, now);
			if (outcome === "succeeded") succeeded++;
			if (outcome === "failed") failed++;
			if (outcome === "dead_letter") {
				failed++;
				terminal++;
			}
		}
		return {
			claimed: claimed.length,
			succeeded,
			failed,
			deadLettered: terminal,
		};
	}

	/**
	 * Mirror terminal deliveries onto their events so an operator sees one
	 * durable state instead of an event that still reads as retryable.
	 */
	private async markExhaustedEvents(
		deliveries: ReadonlyArray<{ eventId: string }>,
		now: Date,
	): Promise<void> {
		const eventIds = [...new Set(deliveries.map((row) => row.eventId))];
		if (eventIds.length === 0) return;
		await this.config.db.moduleOutboxEvent.updateMany({
			where: { id: { in: eventIds }, storeId: this.config.storeId },
			data: {
				deliveryState: "dead_letter",
				nextAttemptAt: now,
				deliveredAt: null,
			},
		});
	}

	private async deliver(
		delivery: ClaimedDelivery,
		now: Date,
	): Promise<"succeeded" | "failed" | "dead_letter" | "stale"> {
		const consumer = this.consumersById.get(delivery.consumer);
		if (!consumer) {
			return this.fail(
				delivery,
				now,
				new DeliveryFailure("EVENT_CONSUMER_MISSING"),
			);
		}

		try {
			const outcome = await this.config.db.$transaction(
				// biome-ignore lint/suspicious/noExplicitAny: transaction client is adapter-private
				async (transaction: any) => {
					const fenced = (await transaction.$queryRawUnsafe(
						`SELECT "consumer", "eventId", "leaseToken", "leaseOwner", "state"
						 FROM "ModuleEventDelivery"
						 WHERE "consumer" = $1 AND "eventId" = $2::uuid
						   AND "state" = 'processing' AND "leaseToken" = $3::uuid
						   AND "leaseOwner" = $4
						 FOR UPDATE`,
						delivery.consumer,
						delivery.eventId,
						delivery.leaseToken,
						delivery.leaseOwner,
					)) as unknown[];
					if (fenced.length !== 1) return "stale" as const;

					const alreadyConsumed =
						await transaction.moduleEventConsumption.findUnique({
							where: {
								consumer_eventId: {
									consumer: delivery.consumer,
									eventId: delivery.eventId,
								},
							},
						});
					if (!alreadyConsumed) {
						if (
							delivery.eventType !== consumer.definition.name ||
							delivery.schemaVersion !== consumer.definition.version ||
							delivery.sourceModule !== consumer.definition.owner
						) {
							throw new DeliveryFailure("EVENT_CONTRACT_MISMATCH");
						}
						const payload = consumer.definition.payload.safeParse(
							delivery.payload,
						);
						if (!payload.success) {
							throw new DeliveryFailure("EVENT_PAYLOAD_INVALID");
						}
						const event: DurableEventEnvelope<typeof consumer.definition> = {
							id: delivery.eventId,
							name: consumer.definition.name,
							version: consumer.definition.version,
							storeId: delivery.storeId,
							sourceModule: consumer.definition.owner,
							aggregate: {
								type: delivery.aggregateType,
								id: delivery.aggregateId,
								sequence: Number(delivery.aggregateSequence),
							},
							occurredAt: delivery.occurredAt,
							payload: payload.data,
						};
						await consumer.handle(
							{
								data: this.config.getConsumerData(consumer.owner, transaction),
							},
							event,
						);
						await transaction.moduleEventConsumption.create({
							data: {
								consumer: delivery.consumer,
								eventId: delivery.eventId,
							},
						});
					}

					const acknowledged = await transaction.moduleEventDelivery.updateMany(
						{
							where: {
								consumer: delivery.consumer,
								eventId: delivery.eventId,
								state: "processing",
								leaseToken: delivery.leaseToken,
								leaseOwner: delivery.leaseOwner,
							},
							data: {
								state: "succeeded",
								succeededAt: now,
								leaseToken: null,
								leaseOwner: null,
								leaseExpiresAt: null,
								lastError: null,
							},
						},
					);
					if (acknowledged.count !== 1) {
						throw new DeliveryFailure("EVENT_LEASE_LOST");
					}
					await transaction.$queryRawUnsafe(
						`UPDATE "ModuleOutboxEvent" event
						 SET "deliveryState" = 'succeeded', "deliveredAt" = $2
						 WHERE event."id" = $1::uuid
						   AND NOT EXISTS (
						     SELECT 1 FROM "ModuleEventDelivery" delivery
						     WHERE delivery."eventId" = event."id" AND delivery."state" <> 'succeeded'
						   )`,
						delivery.eventId,
						now,
					);
					return "succeeded" as const;
				},
			);
			return outcome;
		} catch (error) {
			return this.fail(delivery, now, error);
		}
	}

	/**
	 * Record a failed attempt. Once the attempt budget is spent the delivery
	 * becomes terminal rather than scheduling another retry.
	 */
	private async fail(
		delivery: ClaimedDelivery,
		now: Date,
		error: unknown,
	): Promise<"failed" | "dead_letter"> {
		const exhausted = delivery.attempts >= this.maxAttempts;
		const state = exhausted ? "dead_letter" : "failed";
		const nextAttemptAt = exhausted
			? now
			: new Date(now.getTime() + retryDelay(delivery.attempts));
		const failed = await this.config.db.moduleEventDelivery.updateMany({
			where: {
				consumer: delivery.consumer,
				eventId: delivery.eventId,
				state: "processing",
				leaseToken: delivery.leaseToken,
				leaseOwner: delivery.leaseOwner,
			},
			data: {
				state,
				nextAttemptAt,
				leaseToken: null,
				leaseOwner: null,
				leaseExpiresAt: null,
				lastError: failureCode(error),
			},
		});
		if (failed.count === 1) {
			await this.config.db.moduleOutboxEvent.updateMany({
				where: { id: delivery.eventId, storeId: this.config.storeId },
				data: { deliveryState: state, nextAttemptAt, deliveredAt: null },
			});
		}
		return exhausted ? "dead_letter" : "failed";
	}
}

/**
 * Materialize a delivery row for every registered consumer of an event that
 * does not have one yet. Runs as its own statement so the claim below observes
 * these rows instead of a snapshot taken before they existed.
 */
const MATERIALIZE_SQL = `
WITH registrations AS (
  SELECT
    registration->>'consumer' AS consumer,
    registration->>'owner' AS owner,
    registration->>'eventType' AS "eventType",
    (registration->>'schemaVersion')::integer AS "schemaVersion"
  FROM jsonb_array_elements($4::jsonb) registration
), missing AS (
  SELECT event."id" AS "eventId", registration.consumer
  FROM "ModuleOutboxEvent" event
  JOIN registrations registration
    ON registration."eventType" = event."eventType"
   AND registration."schemaVersion" = event."schemaVersion"
   AND registration.owner = event."sourceModule"
  WHERE event."storeId" = $1::uuid
    AND NOT EXISTS (
      SELECT 1 FROM "ModuleEventDelivery" delivery
      WHERE delivery."eventId" = event."id"
        AND delivery."consumer" = registration.consumer
    )
  ORDER BY event."occurredAt", event."id", registration.consumer
  LIMIT $2
)
INSERT INTO "ModuleEventDelivery" (
  "eventId", "consumer", "state", "attempts", "nextAttemptAt", "createdAt", "updatedAt"
)
SELECT missing."eventId", missing.consumer, 'pending', 0, $3, $3, $3
FROM missing
ON CONFLICT ("consumer", "eventId") DO NOTHING
RETURNING "eventId"
`;

/**
 * Retire deliveries whose attempt budget is spent. A delivery that keeps
 * crashing its process never reaches the failure path, so the budget is
 * enforced here as well as on the failure path.
 */
const DEAD_LETTER_SQL = `
UPDATE "ModuleEventDelivery" delivery
SET "state" = 'dead_letter',
    "nextAttemptAt" = $4,
    "leaseToken" = NULL,
    "leaseOwner" = NULL,
    "leaseExpiresAt" = NULL,
    "lastError" = COALESCE(delivery."lastError", 'EVENT_ATTEMPTS_EXHAUSTED'),
    "updatedAt" = $4
FROM (
  SELECT candidate."consumer", candidate."eventId"
  FROM "ModuleEventDelivery" candidate
  JOIN "ModuleOutboxEvent" event ON event."id" = candidate."eventId"
  WHERE event."storeId" = $1::uuid
    AND candidate."consumer" = ANY($2::text[])
    AND candidate."attempts" >= $5
    AND (
      candidate."state" IN ('pending', 'failed')
      OR (candidate."state" = 'processing' AND candidate."leaseExpiresAt" <= $4)
    )
  ORDER BY candidate."eventId", candidate."consumer"
  FOR UPDATE OF candidate SKIP LOCKED
  LIMIT $3
) exhausted
WHERE delivery."consumer" = exhausted."consumer"
  AND delivery."eventId" = exhausted."eventId"
RETURNING delivery."eventId"
`;

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
        AND prior."state" <> 'succeeded'
    )
  ORDER BY event."occurredAt", event."id", delivery."consumer"
  FOR UPDATE OF delivery SKIP LOCKED
  LIMIT $3
), claimed AS (
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
  RETURNING delivery.*
), event_claims AS (
  -- The delivered timestamp is cleared with the state. An event that already
  -- read as delivered becomes claimable again whenever a new consumer registers
  -- for it, and the completion constraint pairs 'succeeded' with that timestamp.
  UPDATE "ModuleOutboxEvent" event
  SET "deliveryState" = 'processing',
      "attempts" = event."attempts" + 1,
      "nextAttemptAt" = $5,
      "deliveredAt" = NULL
  FROM (SELECT DISTINCT "eventId" FROM claimed) claimed_event
  WHERE event."id" = claimed_event."eventId"
  RETURNING event."id"
)
SELECT
  claimed."eventId", claimed."consumer", claimed."leaseToken", claimed."leaseOwner", claimed."attempts",
  event."eventType", event."schemaVersion", event."storeId", event."sourceModule",
  event."aggregateType", event."aggregateId", event."aggregateSequence",
  event."occurredAt", event."payload"
FROM claimed
JOIN "ModuleOutboxEvent" event ON event."id" = claimed."eventId"
LEFT JOIN event_claims ON event_claims."id" = event."id"
ORDER BY event."occurredAt", event."id", claimed."consumer"
`;
