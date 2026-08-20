-- Plane-local persistence for versioned Commands, durable Workflows, review
-- artifacts, standing permission reservations, and append-only audit events.

CREATE TABLE "ChangeSet" (
    "id" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL,
    "ownerPlane" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "reviewHash" CHAR(64) NOT NULL,
    "targetType" VARCHAR(64) NOT NULL,
    "targetId" VARCHAR(255) NOT NULL,
    "target" JSONB NOT NULL,
    "baseRevisions" JSONB NOT NULL,
    "affectedTargets" JSONB NOT NULL,
    "beforeSummary" JSONB NOT NULL,
    "afterSummary" JSONB NOT NULL,
    "publicEffects" JSONB NOT NULL,
    "operationalEffects" JSONB NOT NULL,
    "estimatedCharges" JSONB NOT NULL,
    "requiredPermissions" JSONB NOT NULL,
    "validationBlocks" JSONB NOT NULL,
    "rollbackCoverage" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "immutableAt" TIMESTAMP(3),

    CONSTRAINT "ChangeSet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChangeSet_version_check" CHECK ("version" > 0),
    CONSTRAINT "ChangeSet_ownerPlane_check" CHECK ("ownerPlane" IN ('control_plane', 'store_runtime')),
    CONSTRAINT "ChangeSet_status_check" CHECK ("status" IN ('draft', 'approved', 'conflicted', 'applied', 'failed')),
    CONSTRAINT "ChangeSet_reviewHash_check" CHECK ("reviewHash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "ChangeSet_rollbackCoverage_check" CHECK ("rollbackCoverage" IN ('none', 'database', 'compensating', 'full'))
);

CREATE TABLE "Approval" (
    "id" VARCHAR(255) NOT NULL,
    "changeSetId" VARCHAR(255) NOT NULL,
    "reviewHash" CHAR(64) NOT NULL,
    "baseRevisions" JSONB NOT NULL,
    "actorType" VARCHAR(64) NOT NULL,
    "actorId" VARCHAR(255) NOT NULL,
    "actor" JSONB NOT NULL,
    "authorityType" VARCHAR(64) NOT NULL,
    "authorityId" VARCHAR(255) NOT NULL,
    "authority" JSONB NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidatedAt" TIMESTAMP(3),

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Approval_reviewHash_check" CHECK ("reviewHash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "Confirmation" (
    "id" VARCHAR(255) NOT NULL,
    "actorType" VARCHAR(64) NOT NULL,
    "actorId" VARCHAR(255) NOT NULL,
    "actor" JSONB NOT NULL,
    "sessionId" VARCHAR(255) NOT NULL,
    "targetType" VARCHAR(64) NOT NULL,
    "targetId" VARCHAR(255) NOT NULL,
    "target" JSONB NOT NULL,
    "bindingHash" CHAR(64) NOT NULL,
    "nonceDigest" CHAR(64) NOT NULL,
    "disclosure" TEXT NOT NULL,
    "amount" DECIMAL(65,0),
    "currency" CHAR(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "Confirmation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Confirmation_bindingHash_check" CHECK ("bindingHash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "Confirmation_nonceDigest_check" CHECK ("nonceDigest" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "Confirmation_expiry_check" CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "Confirmation_amount_check" CHECK ("amount" IS NULL OR "amount" >= 0),
    CONSTRAINT "Confirmation_amount_currency_check" CHECK (("amount" IS NULL) = ("currency" IS NULL)),
    CONSTRAINT "Confirmation_currency_check" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "StandingPermission" (
    "id" VARCHAR(255) NOT NULL,
    "granteeType" VARCHAR(64) NOT NULL,
    "granteeId" VARCHAR(255) NOT NULL,
    "grantee" JSONB NOT NULL,
    "authorityType" VARCHAR(64) NOT NULL,
    "authorityId" VARCHAR(255) NOT NULL,
    "authority" JSONB NOT NULL,
    "businessId" VARCHAR(255) NOT NULL,
    "storeId" VARCHAR(255),
    "actionName" VARCHAR(200) NOT NULL,
    "actionVersion" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "perOperationAmount" DECIMAL(65,0),
    "aggregateAmount" DECIMAL(65,0),
    "currency" CHAR(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "StandingPermission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StandingPermission_actionVersion_check" CHECK ("actionVersion" > 0),
    CONSTRAINT "StandingPermission_validity_check" CHECK ("validUntil" > "validFrom"),
    CONSTRAINT "StandingPermission_perOperationAmount_check" CHECK ("perOperationAmount" IS NULL OR "perOperationAmount" >= 0),
    CONSTRAINT "StandingPermission_aggregateAmount_check" CHECK ("aggregateAmount" IS NULL OR "aggregateAmount" >= 0),
    CONSTRAINT "StandingPermission_currency_required_check" CHECK (("perOperationAmount" IS NULL AND "aggregateAmount" IS NULL) OR "currency" IS NOT NULL),
    CONSTRAINT "StandingPermission_currency_check" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "CommandExecution" (
    "id" VARCHAR(255) NOT NULL,
    "plane" VARCHAR(32) NOT NULL,
    "commandName" VARCHAR(200) NOT NULL,
    "commandVersion" INTEGER NOT NULL,
    "actionLevel" VARCHAR(32) NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "inputDigest" CHAR(64) NOT NULL,
    "redactedInput" JSONB NOT NULL,
    "actorType" VARCHAR(64) NOT NULL,
    "actorId" VARCHAR(255) NOT NULL,
    "actor" JSONB NOT NULL,
    "authorityType" VARCHAR(64) NOT NULL,
    "authorityId" VARCHAR(255) NOT NULL,
    "authority" JSONB NOT NULL,
    "targetType" VARCHAR(64) NOT NULL,
    "targetId" VARCHAR(255) NOT NULL,
    "target" JSONB NOT NULL,
    "approvalId" VARCHAR(255),
    "confirmationId" VARCHAR(255),
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "failure" JSONB,
    "leaseOwner" VARCHAR(255),
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandExecution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommandExecution_plane_check" CHECK ("plane" IN ('control_plane', 'store_runtime')),
    CONSTRAINT "CommandExecution_version_check" CHECK ("commandVersion" > 0),
    CONSTRAINT "CommandExecution_actionLevel_check" CHECK ("actionLevel" IN ('automatic', 'approve', 'confirm_now')),
    CONSTRAINT "CommandExecution_inputDigest_check" CHECK ("inputDigest" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "CommandExecution_status_check" CHECK ("status" IN ('pending', 'running', 'succeeded', 'failed')),
    CONSTRAINT "CommandExecution_outcome_check" CHECK (
        ("status" = 'succeeded' AND "result" IS NOT NULL AND "failure" IS NULL AND "completedAt" IS NOT NULL)
        OR ("status" = 'failed' AND "failure" IS NOT NULL AND "completedAt" IS NOT NULL)
        OR ("status" IN ('pending', 'running') AND "result" IS NULL AND "failure" IS NULL AND "completedAt" IS NULL)
    )
);

CREATE TABLE "StandingPermissionUseReservation" (
    "id" VARCHAR(255) NOT NULL,
    "standingPermissionId" VARCHAR(255) NOT NULL,
    "commandExecutionId" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(65,0) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "state" VARCHAR(32) NOT NULL DEFAULT 'reserved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandingPermissionUseReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StandingPermissionUseReservation_amount_check" CHECK ("amount" >= 0),
    CONSTRAINT "StandingPermissionUseReservation_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "StandingPermissionUseReservation_state_check" CHECK ("state" IN ('reserved', 'committed', 'released', 'ambiguous'))
);

CREATE TABLE "Workflow" (
    "id" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL,
    "plane" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "state" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "targetType" VARCHAR(64) NOT NULL,
    "targetId" VARCHAR(255) NOT NULL,
    "target" JSONB NOT NULL,
    "commandExecutionId" VARCHAR(255),
    "currentStep" VARCHAR(200),
    "failure" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Workflow_version_check" CHECK ("version" > 0),
    CONSTRAINT "Workflow_plane_check" CHECK ("plane" IN ('control_plane', 'store_runtime')),
    CONSTRAINT "Workflow_state_check" CHECK ("state" IN ('pending', 'running', 'completed', 'rolled_back', 'failed', 'needs_attention'))
);

CREATE TABLE "WorkflowStep" (
    "id" VARCHAR(255) NOT NULL,
    "workflowId" VARCHAR(255) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "position" INTEGER NOT NULL,
    "state" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "providerReference" VARCHAR(500),
    "failure" JSONB,
    "leaseOwner" VARCHAR(255),
    "leaseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkflowStep_position_check" CHECK ("position" >= 0),
    CONSTRAINT "WorkflowStep_state_check" CHECK ("state" IN ('pending', 'running', 'completed', 'rolled_back', 'failed', 'needs_attention'))
);

CREATE TABLE "WorkflowAttempt" (
    "id" VARCHAR(255) NOT NULL,
    "stepId" VARCHAR(255) NOT NULL,
    "attempt" INTEGER NOT NULL,
    "state" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "operationKey" VARCHAR(500) NOT NULL,
    "providerReference" VARCHAR(500),
    "failure" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkflowAttempt_attempt_check" CHECK ("attempt" > 0),
    CONSTRAINT "WorkflowAttempt_state_check" CHECK ("state" IN ('pending', 'running', 'succeeded', 'failed', 'ambiguous'))
);

CREATE TABLE "AuditEvent" (
    "id" VARCHAR(255) NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "version" INTEGER NOT NULL,
    "plane" VARCHAR(32) NOT NULL,
    "eventType" VARCHAR(200) NOT NULL,
    "actorType" VARCHAR(64) NOT NULL,
    "actorId" VARCHAR(255) NOT NULL,
    "actor" JSONB NOT NULL,
    "authorityType" VARCHAR(64) NOT NULL,
    "authorityId" VARCHAR(255) NOT NULL,
    "authority" JSONB NOT NULL,
    "targetType" VARCHAR(64) NOT NULL,
    "targetId" VARCHAR(255) NOT NULL,
    "target" JSONB NOT NULL,
    "commandName" VARCHAR(200),
    "commandVersion" INTEGER,
    "commandExecutionId" VARCHAR(255),
    "workflowId" VARCHAR(255),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditEvent_version_check" CHECK ("version" > 0),
    CONSTRAINT "AuditEvent_plane_check" CHECK ("plane" IN ('control_plane', 'store_runtime')),
    CONSTRAINT "AuditEvent_command_check" CHECK (("commandName" IS NULL) = ("commandVersion" IS NULL)),
    CONSTRAINT "AuditEvent_commandVersion_check" CHECK ("commandVersion" IS NULL OR "commandVersion" > 0)
);

CREATE INDEX "ChangeSet_ownerPlane_targetType_targetId_status_idx" ON "ChangeSet"("ownerPlane", "targetType", "targetId", "status");
CREATE INDEX "ChangeSet_reviewHash_idx" ON "ChangeSet"("reviewHash");

CREATE UNIQUE INDEX "Approval_changeSetId_reviewHash_actorType_actorId_key" ON "Approval"("changeSetId", "reviewHash", "actorType", "actorId");
CREATE INDEX "Approval_actorType_actorId_approvedAt_idx" ON "Approval"("actorType", "actorId", "approvedAt");

CREATE UNIQUE INDEX "Confirmation_nonceDigest_key" ON "Confirmation"("nonceDigest");
CREATE INDEX "Confirmation_actorType_actorId_sessionId_expiresAt_idx" ON "Confirmation"("actorType", "actorId", "sessionId", "expiresAt");
CREATE INDEX "Confirmation_targetType_targetId_expiresAt_idx" ON "Confirmation"("targetType", "targetId", "expiresAt");

CREATE INDEX "StandingPermission_scope_idx" ON "StandingPermission"("granteeType", "granteeId", "businessId", "storeId", "actionName", "actionVersion");
CREATE INDEX "StandingPermission_validUntil_revokedAt_idx" ON "StandingPermission"("validUntil", "revokedAt");

CREATE UNIQUE INDEX "CommandExecution_confirmationId_key" ON "CommandExecution"("confirmationId");
CREATE UNIQUE INDEX "CommandExecution_scope_idempotency_key" ON "CommandExecution"("plane", "actorType", "actorId", "authorityType", "authorityId", "targetType", "targetId", "commandName", "commandVersion", "idempotencyKey");
CREATE INDEX "CommandExecution_actorType_actorId_createdAt_idx" ON "CommandExecution"("actorType", "actorId", "createdAt");
CREATE INDEX "CommandExecution_targetType_targetId_createdAt_idx" ON "CommandExecution"("targetType", "targetId", "createdAt");
CREATE INDEX "CommandExecution_status_leaseExpiresAt_idx" ON "CommandExecution"("status", "leaseExpiresAt");
CREATE INDEX "CommandExecution_approvalId_idx" ON "CommandExecution"("approvalId");

CREATE UNIQUE INDEX "StandingPermissionUseReservation_permission_execution_key" ON "StandingPermissionUseReservation"("standingPermissionId", "commandExecutionId");
CREATE INDEX "StandingPermissionUseReservation_standingPermissionId_state_idx" ON "StandingPermissionUseReservation"("standingPermissionId", "state");
CREATE INDEX "StandingPermissionUseReservation_commandExecutionId_idx" ON "StandingPermissionUseReservation"("commandExecutionId");

CREATE INDEX "Workflow_commandExecutionId_idx" ON "Workflow"("commandExecutionId");
CREATE INDEX "Workflow_targetType_targetId_state_idx" ON "Workflow"("targetType", "targetId", "state");
CREATE INDEX "Workflow_state_updatedAt_idx" ON "Workflow"("state", "updatedAt");

CREATE UNIQUE INDEX "WorkflowStep_workflowId_position_key" ON "WorkflowStep"("workflowId", "position");
CREATE INDEX "WorkflowStep_state_leaseExpiresAt_idx" ON "WorkflowStep"("state", "leaseExpiresAt");

CREATE UNIQUE INDEX "WorkflowAttempt_stepId_attempt_key" ON "WorkflowAttempt"("stepId", "attempt");
CREATE INDEX "WorkflowAttempt_operationKey_idx" ON "WorkflowAttempt"("operationKey");
CREATE INDEX "WorkflowAttempt_state_startedAt_idx" ON "WorkflowAttempt"("state", "startedAt");

CREATE UNIQUE INDEX "AuditEvent_sequence_key" ON "AuditEvent"("sequence");
CREATE INDEX "AuditEvent_plane_eventType_occurredAt_idx" ON "AuditEvent"("plane", "eventType", "occurredAt");
CREATE INDEX "AuditEvent_actorType_actorId_occurredAt_idx" ON "AuditEvent"("actorType", "actorId", "occurredAt");
CREATE INDEX "AuditEvent_targetType_targetId_occurredAt_idx" ON "AuditEvent"("targetType", "targetId", "occurredAt");
CREATE INDEX "AuditEvent_commandExecutionId_idx" ON "AuditEvent"("commandExecutionId");
CREATE INDEX "AuditEvent_workflowId_idx" ON "AuditEvent"("workflowId");

ALTER TABLE "Approval" ADD CONSTRAINT "Approval_changeSetId_fkey" FOREIGN KEY ("changeSetId") REFERENCES "ChangeSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommandExecution" ADD CONSTRAINT "CommandExecution_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommandExecution" ADD CONSTRAINT "CommandExecution_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "Confirmation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StandingPermissionUseReservation" ADD CONSTRAINT "StandingPermissionUseReservation_standingPermissionId_fkey" FOREIGN KEY ("standingPermissionId") REFERENCES "StandingPermission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StandingPermissionUseReservation" ADD CONSTRAINT "StandingPermissionUseReservation_commandExecutionId_fkey" FOREIGN KEY ("commandExecutionId") REFERENCES "CommandExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_commandExecutionId_fkey" FOREIGN KEY ("commandExecutionId") REFERENCES "CommandExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowAttempt" ADD CONSTRAINT "WorkflowAttempt_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_commandExecutionId_fkey" FOREIGN KEY ("commandExecutionId") REFERENCES "CommandExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AuditEvent is append-only. Application attempts to update, delete, or
-- truncate authoritative history fail at the database seam.
CREATE FUNCTION "reject_audit_event_mutation"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'AuditEvent is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditEvent_reject_update_delete"
    BEFORE UPDATE OR DELETE ON "AuditEvent"
    FOR EACH ROW EXECUTE FUNCTION "reject_audit_event_mutation"();

CREATE TRIGGER "AuditEvent_reject_truncate"
    BEFORE TRUNCATE ON "AuditEvent"
    FOR EACH STATEMENT EXECUTE FUNCTION "reject_audit_event_mutation"();
