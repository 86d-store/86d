BEGIN;

CREATE TABLE "ModuleEventSequence" (
    "storeId" UUID NOT NULL,
    "sourceModule" VARCHAR(100) NOT NULL,
    "aggregateType" VARCHAR(100) NOT NULL,
    "aggregateId" VARCHAR(255) NOT NULL,
    "lastSequence" BIGINT NOT NULL,
    CONSTRAINT "ModuleEventSequence_pkey"
        PRIMARY KEY ("storeId", "sourceModule", "aggregateType", "aggregateId"),
    CONSTRAINT "ModuleEventSequence_sourceModule_nonempty_check"
        CHECK (char_length(btrim("sourceModule")) > 0),
    CONSTRAINT "ModuleEventSequence_aggregateType_nonempty_check"
        CHECK (char_length(btrim("aggregateType")) > 0),
    CONSTRAINT "ModuleEventSequence_aggregateId_nonempty_check"
        CHECK (char_length(btrim("aggregateId")) > 0),
    CONSTRAINT "ModuleEventSequence_lastSequence_safe_check"
        CHECK ("lastSequence" BETWEEN 1 AND 9007199254740991),
    CONSTRAINT "ModuleEventSequence_owner_fkey"
        FOREIGN KEY ("storeId", "sourceModule")
        REFERENCES "Module"("storeId", "name")
        ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "Module_outbox_owner_key"
    ON "Module"("id", "storeId", "name");

CREATE TABLE "ModuleOutboxEvent" (
    "id" UUID NOT NULL,
    "eventType" VARCHAR(200) NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "storeId" UUID NOT NULL,
    "sourceModule" VARCHAR(100) NOT NULL,
    "aggregateType" VARCHAR(100) NOT NULL,
    "aggregateId" VARCHAR(255) NOT NULL,
    "aggregateSequence" BIGINT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "deliveryState" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moduleId" UUID NOT NULL,
    CONSTRAINT "ModuleOutboxEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ModuleOutboxEvent_eventType_nonempty_check"
        CHECK (char_length(btrim("eventType")) > 0),
    CONSTRAINT "ModuleOutboxEvent_schemaVersion_positive_check"
        CHECK ("schemaVersion" > 0),
    CONSTRAINT "ModuleOutboxEvent_sourceModule_nonempty_check"
        CHECK (char_length(btrim("sourceModule")) > 0),
    CONSTRAINT "ModuleOutboxEvent_aggregateType_nonempty_check"
        CHECK (char_length(btrim("aggregateType")) > 0),
    CONSTRAINT "ModuleOutboxEvent_aggregateId_nonempty_check"
        CHECK (char_length(btrim("aggregateId")) > 0),
    CONSTRAINT "ModuleOutboxEvent_aggregateSequence_safe_check"
        CHECK ("aggregateSequence" BETWEEN 1 AND 9007199254740991),
    CONSTRAINT "ModuleOutboxEvent_deliveryState_check"
        CHECK ("deliveryState" IN ('pending', 'processing', 'succeeded', 'failed')),
    CONSTRAINT "ModuleOutboxEvent_attempts_nonnegative_check"
        CHECK ("attempts" >= 0),
    CONSTRAINT "ModuleOutboxEvent_active_attempt_check"
        CHECK ("deliveryState" NOT IN ('processing', 'failed') OR "attempts" > 0),
    CONSTRAINT "ModuleOutboxEvent_delivery_completion_check"
        CHECK (
            ("deliveryState" = 'succeeded' AND "deliveredAt" IS NOT NULL)
            OR ("deliveryState" <> 'succeeded' AND "deliveredAt" IS NULL)
        ),
    CONSTRAINT "ModuleOutboxEvent_moduleId_fkey"
        FOREIGN KEY ("moduleId", "storeId", "sourceModule")
        REFERENCES "Module"("id", "storeId", "name")
        ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "ModuleOutboxEvent_aggregate_order_key"
    ON "ModuleOutboxEvent"(
        "storeId",
        "sourceModule",
        "aggregateType",
        "aggregateId",
        "aggregateSequence"
    );

CREATE INDEX "ModuleOutboxEvent_delivery_claim_idx"
    ON "ModuleOutboxEvent"("deliveryState", "nextAttemptAt", "occurredAt", "id");

CREATE TABLE "ModuleEventDelivery" (
    "eventId" UUID NOT NULL,
    "consumer" VARCHAR(200) NOT NULL,
    "state" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" UUID,
    "leaseOwner" VARCHAR(200),
    "leaseExpiresAt" TIMESTAMP(3),
    "lastError" VARCHAR(500),
    "succeededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModuleEventDelivery_pkey" PRIMARY KEY ("consumer", "eventId"),
    CONSTRAINT "ModuleEventDelivery_consumer_nonempty_check"
        CHECK (char_length(btrim("consumer")) > 0),
    CONSTRAINT "ModuleEventDelivery_state_check"
        CHECK ("state" IN ('pending', 'processing', 'succeeded', 'failed')),
    CONSTRAINT "ModuleEventDelivery_attempts_nonnegative_check"
        CHECK ("attempts" >= 0),
    CONSTRAINT "ModuleEventDelivery_attempt_state_check"
        CHECK ("state" = 'pending' OR "attempts" > 0),
    CONSTRAINT "ModuleEventDelivery_leaseOwner_nonempty_check"
        CHECK ("leaseOwner" IS NULL OR char_length(btrim("leaseOwner")) > 0),
    CONSTRAINT "ModuleEventDelivery_lastError_nonempty_check"
        CHECK ("lastError" IS NULL OR char_length(btrim("lastError")) > 0),
    CONSTRAINT "ModuleEventDelivery_lifecycle_check"
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
                "state" = 'succeeded'
                AND "leaseToken" IS NULL
                AND "leaseOwner" IS NULL
                AND "leaseExpiresAt" IS NULL
                AND "succeededAt" IS NOT NULL
            )
        ),
    CONSTRAINT "ModuleEventDelivery_eventId_fkey"
        FOREIGN KEY ("eventId") REFERENCES "ModuleOutboxEvent"("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- The full indexes above are represented in Prisma so schema drift remains visible.
CREATE INDEX "ModuleEventDelivery_claim_idx"
    ON "ModuleEventDelivery"("consumer", "state", "nextAttemptAt", "eventId");

CREATE INDEX "ModuleEventDelivery_lease_idx"
    ON "ModuleEventDelivery"("consumer", "state", "leaseExpiresAt", "eventId");

CREATE INDEX "ModuleEventDelivery_eventId_idx"
    ON "ModuleEventDelivery"("eventId");

-- Claim scans never need completed deliveries; stale-lease scans never need
-- non-processing rows. These partial indexes keep both explicit drain paths bounded.
CREATE INDEX "ModuleEventDelivery_claimable_idx"
    ON "ModuleEventDelivery"("consumer", "nextAttemptAt", "eventId")
    WHERE "state" IN ('pending', 'failed');

CREATE INDEX "ModuleEventDelivery_stale_lease_idx"
    ON "ModuleEventDelivery"("consumer", "leaseExpiresAt", "eventId")
    WHERE "state" = 'processing';

CREATE TABLE "ModuleEventConsumption" (
    "consumer" VARCHAR(200) NOT NULL,
    "eventId" UUID NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModuleEventConsumption_pkey" PRIMARY KEY ("consumer", "eventId"),
    CONSTRAINT "ModuleEventConsumption_consumer_nonempty_check"
        CHECK (char_length(btrim("consumer")) > 0),
    CONSTRAINT "ModuleEventConsumption_delivery_fkey"
        FOREIGN KEY ("consumer", "eventId")
        REFERENCES "ModuleEventDelivery"("consumer", "eventId")
        ON DELETE RESTRICT ON UPDATE RESTRICT
);

COMMIT;
