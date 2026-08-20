-- A durable delivery had no terminal failure state, so a poison event stayed
-- claimable forever. `dead_letter` is that terminal state: it is never claimed,
-- it retains the last failure reason for an operator, and it deliberately holds
-- the rest of its aggregate so no later event is applied out of order.

BEGIN;

ALTER TABLE "ModuleEventDelivery"
    DROP CONSTRAINT "ModuleEventDelivery_state_check";

ALTER TABLE "ModuleEventDelivery"
    ADD CONSTRAINT "ModuleEventDelivery_state_check"
    CHECK ("state" IN ('pending', 'processing', 'succeeded', 'failed', 'dead_letter'));

ALTER TABLE "ModuleEventDelivery"
    DROP CONSTRAINT "ModuleEventDelivery_lifecycle_check";

ALTER TABLE "ModuleEventDelivery"
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
            -- Terminal. The lease is released, the reason is retained, and the
            -- delivery never succeeded.
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

ALTER TABLE "ModuleOutboxEvent"
    DROP CONSTRAINT "ModuleOutboxEvent_deliveryState_check";

ALTER TABLE "ModuleOutboxEvent"
    ADD CONSTRAINT "ModuleOutboxEvent_deliveryState_check"
    CHECK ("deliveryState" IN ('pending', 'processing', 'succeeded', 'failed', 'dead_letter'));

ALTER TABLE "ModuleOutboxEvent"
    DROP CONSTRAINT "ModuleOutboxEvent_active_attempt_check";

ALTER TABLE "ModuleOutboxEvent"
    ADD CONSTRAINT "ModuleOutboxEvent_active_attempt_check"
    CHECK (
        "deliveryState" NOT IN ('processing', 'failed', 'dead_letter')
        OR "attempts" > 0
    );

-- A dead-lettered delivery is terminal, so it must stay out of the claim path.
-- The claimable partial index already covers only ('pending', 'failed'); this
-- index makes the terminal set cheap to inspect for operators.
CREATE INDEX "ModuleEventDelivery_dead_letter_idx"
    ON "ModuleEventDelivery"("consumer", "eventId")
    WHERE "state" = 'dead_letter';

COMMIT;
