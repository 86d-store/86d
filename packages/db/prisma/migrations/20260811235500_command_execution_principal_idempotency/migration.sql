-- Authority is an immutable execution snapshot, not part of idempotency identity.
-- Abort before changing the index if historical executions reused a logical key
-- through different authority grants; those records require explicit review.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "CommandExecution"
        GROUP BY
            "plane",
            "actorType",
            "actorId",
            "targetType",
            "targetId",
            "commandName",
            "commandVersion",
            "idempotencyKey"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot migrate Command idempotency scope: duplicate principal-scoped execution keys require explicit review';
    END IF;
END $$;

DROP INDEX "CommandExecution_scope_idempotency_key";

CREATE UNIQUE INDEX "CommandExecution_scope_idempotency_key" ON "CommandExecution"(
    "plane",
    "actorType",
    "actorId",
    "targetType",
    "targetId",
    "commandName",
    "commandVersion",
    "idempotencyKey"
);
