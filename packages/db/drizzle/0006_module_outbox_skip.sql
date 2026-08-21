BEGIN;

-- Audited skip terminal for dead-lettered deliveries. Skip unblocks head-of-line
-- aggregate ordering without writing a consumption receipt.

ALTER TABLE "ModuleOutboxEvent"
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_deliveryState_check",
	DROP CONSTRAINT IF EXISTS "ModuleOutboxEvent_delivery_completion_check";

ALTER TABLE "ModuleOutboxEvent"
	ADD CONSTRAINT "ModuleOutboxEvent_deliveryState_check"
		CHECK ("deliveryState" IN (
			'pending', 'processing', 'succeeded', 'failed', 'dead_letter', 'skipped'
		)),
	ADD CONSTRAINT "ModuleOutboxEvent_delivery_completion_check"
		CHECK (
			(
				"deliveryState" IN ('succeeded', 'skipped')
				AND "deliveredAt" IS NOT NULL
			)
			OR (
				"deliveryState" NOT IN ('succeeded', 'skipped')
				AND "deliveredAt" IS NULL
			)
		);

ALTER TABLE "ModuleEventDelivery"
	DROP CONSTRAINT IF EXISTS "ModuleEventDelivery_state_check",
	DROP CONSTRAINT IF EXISTS "ModuleEventDelivery_lifecycle_check";

ALTER TABLE "ModuleEventDelivery"
	ADD CONSTRAINT "ModuleEventDelivery_state_check"
		CHECK ("state" IN (
			'pending', 'processing', 'succeeded', 'failed', 'dead_letter', 'skipped'
		)),
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
			OR (
				"state" = 'skipped'
				AND "leaseToken" IS NULL
				AND "leaseOwner" IS NULL
				AND "leaseExpiresAt" IS NULL
				AND "lastError" IS NOT NULL
				AND "succeededAt" IS NOT NULL
			)
		);

COMMIT;
