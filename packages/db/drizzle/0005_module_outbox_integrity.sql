BEGIN;

-- Outbox integrity added after the baseline table create (checks, partial
-- indexes, and dead_letter terminal state).

CREATE UNIQUE INDEX IF NOT EXISTS "Module_outbox_owner_key"
	ON "Module"("id", "storeId", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "Module_storeId_name_key"
	ON "Module"("storeId", "name");

ALTER TABLE "ModuleEventSequence"
	DROP CONSTRAINT IF EXISTS "ModuleEventSequence_sourceModule_nonempty_check",
	DROP CONSTRAINT IF EXISTS "ModuleEventSequence_aggregateType_nonempty_check",
	DROP CONSTRAINT IF EXISTS "ModuleEventSequence_aggregateId_nonempty_check",
	DROP CONSTRAINT IF EXISTS "ModuleEventSequence_lastSequence_safe_check";

ALTER TABLE "ModuleEventSequence"
	ADD CONSTRAINT "ModuleEventSequence_sourceModule_nonempty_check"
		CHECK (char_length(btrim("sourceModule")) > 0),
	ADD CONSTRAINT "ModuleEventSequence_aggregateType_nonempty_check"
		CHECK (char_length(btrim("aggregateType")) > 0),
	ADD CONSTRAINT "ModuleEventSequence_aggregateId_nonempty_check"
		CHECK (char_length(btrim("aggregateId")) > 0),
	ADD CONSTRAINT "ModuleEventSequence_lastSequence_safe_check"
		CHECK ("lastSequence" BETWEEN 1 AND 9007199254740991);

ALTER TABLE "ModuleOutboxEvent"
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_eventType_nonempty_check",
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_schemaVersion_positive_check",
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_sourceModule_nonempty_check",
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_aggregateType_nonempty_check",
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_aggregateId_nonempty_check",
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_aggregateSequence_safe_check",
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_deliveryState_check",
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_attempts_nonnegative_check",
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_active_attempt_check",
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_delivery_completion_check";

ALTER TABLE "ModuleOutboxEvent"
	ADD CONSTRAINT "ModuleOutboxEvent_eventType_nonempty_check"
		CHECK (char_length(btrim("eventType")) > 0),
	ADD CONSTRAINT "ModuleOutboxEvent_schemaVersion_positive_check"
		CHECK ("schemaVersion" > 0),
	ADD CONSTRAINT "ModuleOutboxEvent_sourceModule_nonempty_check"
		CHECK (char_length(btrim("sourceModule")) > 0),
	ADD CONSTRAINT "ModuleOutboxEvent_aggregateType_nonempty_check"
		CHECK (char_length(btrim("aggregateType")) > 0),
	ADD CONSTRAINT "ModuleOutboxEvent_aggregateId_nonempty_check"
		CHECK (char_length(btrim("aggregateId")) > 0),
	ADD CONSTRAINT "ModuleOutboxEvent_aggregateSequence_safe_check"
		CHECK ("aggregateSequence" BETWEEN 1 AND 9007199254740991),
	ADD CONSTRAINT "ModuleOutboxEvent_deliveryState_check"
		CHECK ("deliveryState" IN ('pending', 'processing', 'succeeded', 'failed', 'dead_letter')),
	ADD CONSTRAINT "ModuleOutboxEvent_attempts_nonnegative_check"
		CHECK ("attempts" >= 0),
	ADD CONSTRAINT "ModuleOutboxEvent_active_attempt_check"
		CHECK (
			"deliveryState" NOT IN ('processing', 'failed', 'dead_letter')
			OR "attempts" > 0
		),
	ADD CONSTRAINT "ModuleOutboxEvent_delivery_completion_check"
		CHECK (
			("deliveryState" = 'succeeded' AND "deliveredAt" IS NOT NULL)
			OR ("deliveryState" <> 'succeeded' AND "deliveredAt" IS NULL)
		);

ALTER TABLE "ModuleEventDelivery"
	DROP CONSTRAINT IF EXISTS "ModuleEventDelivery_consumer_nonempty_check",
	DROP CONSTRAINT IF EXISTS "ModuleEventDelivery_state_check",
	DROP CONSTRAINT IF EXISTS "ModuleEventDelivery_attempts_nonnegative_check",
	DROP CONSTRAINT IF EXISTS "ModuleEventDelivery_attempt_state_check",
	DROP CONSTRAINT IF EXISTS "ModuleEventDelivery_leaseOwner_nonempty_check",
	DROP CONSTRAINT IF EXISTS "ModuleEventDelivery_lastError_nonempty_check",
	DROP CONSTRAINT IF EXISTS "ModuleEventDelivery_lifecycle_check";

ALTER TABLE "ModuleEventDelivery"
	ADD CONSTRAINT "ModuleEventDelivery_consumer_nonempty_check"
		CHECK (char_length(btrim("consumer")) > 0),
	ADD CONSTRAINT "ModuleEventDelivery_state_check"
		CHECK ("state" IN ('pending', 'processing', 'succeeded', 'failed', 'dead_letter')),
	ADD CONSTRAINT "ModuleEventDelivery_attempts_nonnegative_check"
		CHECK ("attempts" >= 0),
	ADD CONSTRAINT "ModuleEventDelivery_attempt_state_check"
		CHECK ("state" = 'pending' OR "attempts" > 0),
	ADD CONSTRAINT "ModuleEventDelivery_leaseOwner_nonempty_check"
		CHECK ("leaseOwner" IS NULL OR char_length(btrim("leaseOwner")) > 0),
	ADD CONSTRAINT "ModuleEventDelivery_lastError_nonempty_check"
		CHECK ("lastError" IS NULL OR char_length(btrim("lastError")) > 0),
	ADD CONSTRAINT "ModuleEventDelivery_lifecycle_check"
		CHECK (
			(
				"state" = 'pending'
				AND "leaseToken" IS NULL
				AND "leaseOwner" IS NULL
				AND "leaseExpiresAt" IS NULL
				AND "lastError" IS NULL
				AND "succeededAt" IS NULL
			)
			OR (
				"state" = 'processing'
				AND "leaseToken" IS NOT NULL
				AND "leaseOwner" IS NOT NULL
				AND "leaseExpiresAt" IS NOT NULL
				AND "succeededAt" IS NULL
			)
			OR (
				"state" = 'failed'
				AND "leaseToken" IS NULL
				AND "leaseOwner" IS NULL
				AND "leaseExpiresAt" IS NULL
				AND "lastError" IS NOT NULL
				AND "succeededAt" IS NULL
			)
			OR (
				"state" = 'dead_letter'
				AND "leaseToken" IS NULL
				AND "leaseOwner" IS NULL
				AND "leaseExpiresAt" IS NULL
				AND "lastError" IS NOT NULL
				AND "succeededAt" IS NULL
			)
			OR (
				"state" = 'succeeded'
				AND "leaseToken" IS NULL
				AND "leaseOwner" IS NULL
				AND "leaseExpiresAt" IS NULL
				AND "succeededAt" IS NOT NULL
			)
		);

CREATE INDEX IF NOT EXISTS "ModuleEventDelivery_claimable_idx"
	ON "ModuleEventDelivery"("consumer", "nextAttemptAt", "eventId")
	WHERE "state" IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS "ModuleEventDelivery_stale_lease_idx"
	ON "ModuleEventDelivery"("consumer", "leaseExpiresAt", "eventId")
	WHERE "state" = 'processing';

CREATE INDEX IF NOT EXISTS "ModuleEventDelivery_dead_letter_idx"
	ON "ModuleEventDelivery"("consumer", "eventId")
	WHERE "state" = 'dead_letter';

COMMIT;
