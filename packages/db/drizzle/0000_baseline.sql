CREATE TABLE "Account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30) NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp(3),
	"refreshTokenExpiresAt" timestamp(3),
	"scope" text,
	"password" text,
	"metadata" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Approval" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"changeSetId" varchar(255) NOT NULL,
	"reviewHash" char(64) NOT NULL,
	"baseRevisions" jsonb NOT NULL,
	"actorType" varchar(64) NOT NULL,
	"actorId" varchar(255) NOT NULL,
	"actor" jsonb NOT NULL,
	"authorityType" varchar(64) NOT NULL,
	"authorityId" varchar(255) NOT NULL,
	"authority" jsonb NOT NULL,
	"approvedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"invalidatedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "AuditEvent" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"sequence" bigserial NOT NULL,
	"version" integer NOT NULL,
	"plane" varchar(32) NOT NULL,
	"eventType" varchar(200) NOT NULL,
	"actorType" varchar(64) NOT NULL,
	"actorId" varchar(255) NOT NULL,
	"actor" jsonb NOT NULL,
	"authorityType" varchar(64) NOT NULL,
	"authorityId" varchar(255) NOT NULL,
	"authority" jsonb NOT NULL,
	"targetType" varchar(64) NOT NULL,
	"targetId" varchar(255) NOT NULL,
	"target" jsonb NOT NULL,
	"commandName" varchar(200),
	"commandVersion" integer,
	"commandExecutionId" varchar(255),
	"workflowId" varchar(255),
	"occurredAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChangeSet" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"changeSetHashVersion" integer DEFAULT 1 NOT NULL,
	"ownerPlane" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"reviewHash" char(64) NOT NULL,
	"targetType" varchar(64) NOT NULL,
	"targetId" varchar(255) NOT NULL,
	"target" jsonb NOT NULL,
	"proposal" jsonb NOT NULL,
	"supersedesChangeSetId" varchar(255),
	"baseRevisions" jsonb NOT NULL,
	"affectedTargets" jsonb NOT NULL,
	"beforeSummary" jsonb NOT NULL,
	"afterSummary" jsonb NOT NULL,
	"publicEffects" jsonb NOT NULL,
	"operationalEffects" jsonb NOT NULL,
	"estimatedCharges" jsonb NOT NULL,
	"requiredPermissions" jsonb NOT NULL,
	"validationBlocks" jsonb NOT NULL,
	"rollbackCoverage" varchar(32) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"immutableAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "CommandExecution" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"plane" varchar(32) NOT NULL,
	"commandName" varchar(200) NOT NULL,
	"commandVersion" integer NOT NULL,
	"actionLevel" varchar(32) NOT NULL,
	"idempotencyKey" varchar(200) NOT NULL,
	"requestDigestVersion" integer DEFAULT 1 NOT NULL,
	"inputDigest" char(64) NOT NULL,
	"commandBindingHashVersion" integer,
	"commandBindingHash" char(64),
	"grantUse" jsonb,
	"redactedInput" jsonb NOT NULL,
	"actorType" varchar(64) NOT NULL,
	"actorId" varchar(255) NOT NULL,
	"actor" jsonb NOT NULL,
	"authorityType" varchar(64) NOT NULL,
	"authorityId" varchar(255) NOT NULL,
	"authority" jsonb NOT NULL,
	"targetType" varchar(64) NOT NULL,
	"targetId" varchar(255) NOT NULL,
	"target" jsonb NOT NULL,
	"approvalId" varchar(255),
	"confirmationId" varchar(255),
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"failure" jsonb,
	"leaseOwner" varchar(255),
	"leaseExpiresAt" timestamp(3),
	"startedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Confirmation" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"actorType" varchar(64) NOT NULL,
	"actorId" varchar(255) NOT NULL,
	"actor" jsonb NOT NULL,
	"sessionId" varchar(255) NOT NULL,
	"targetType" varchar(64) NOT NULL,
	"targetId" varchar(255) NOT NULL,
	"target" jsonb NOT NULL,
	"commandName" varchar(200) NOT NULL,
	"commandVersion" integer NOT NULL,
	"bindingHashVersion" integer NOT NULL,
	"bindingHash" char(64) NOT NULL,
	"nonceDigest" char(64) NOT NULL,
	"disclosure" text NOT NULL,
	"amount" numeric(65, 0),
	"currency" char(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"consumedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "File" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30) NOT NULL,
	"name" text,
	"description" text,
	"url" text NOT NULL,
	"mediaType" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Invitation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30) NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"inviterId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30) NOT NULL,
	"action" text NOT NULL,
	"data" jsonb,
	"timestamp" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"actorId" uuid,
	"targetId" uuid,
	"accountId" uuid,
	"sessionId" uuid,
	"invitationId" uuid
);
--> statement-breakpoint
CREATE TABLE "Module" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30) NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"isEnabled" boolean DEFAULT true NOT NULL,
	"settings" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"store" jsonb,
	"storeId" uuid,
	CONSTRAINT "Module_storeId_name_key" UNIQUE("storeId","name"),
	CONSTRAINT "Module_outbox_owner_key" UNIQUE("id","storeId","name")
);
--> statement-breakpoint
CREATE TABLE "ModuleData" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30) NOT NULL,
	"entityType" varchar(100) NOT NULL,
	"entityId" varchar(255) NOT NULL,
	"data" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"moduleId" uuid NOT NULL,
	"parentId" uuid
);
--> statement-breakpoint
CREATE TABLE "ModuleEventConsumption" (
	"consumer" varchar(200) NOT NULL,
	"eventId" uuid NOT NULL,
	"consumedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ModuleEventConsumption_pkey" PRIMARY KEY("consumer","eventId")
);
--> statement-breakpoint
CREATE TABLE "ModuleEventDelivery" (
	"eventId" uuid NOT NULL,
	"consumer" varchar(200) NOT NULL,
	"state" varchar(32) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"nextAttemptAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"leaseToken" uuid,
	"leaseOwner" varchar(200),
	"leaseExpiresAt" timestamp(3),
	"lastError" varchar(500),
	"succeededAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ModuleEventDelivery_pkey" PRIMARY KEY("consumer","eventId")
);
--> statement-breakpoint
CREATE TABLE "ModuleEventSequence" (
	"storeId" uuid NOT NULL,
	"sourceModule" varchar(100) NOT NULL,
	"aggregateType" varchar(100) NOT NULL,
	"aggregateId" varchar(255) NOT NULL,
	"lastSequence" bigint NOT NULL,
	CONSTRAINT "ModuleEventSequence_pkey" PRIMARY KEY("storeId","sourceModule","aggregateType","aggregateId")
);
--> statement-breakpoint
CREATE TABLE "ModuleOutboxEvent" (
	"id" uuid PRIMARY KEY NOT NULL,
	"eventType" varchar(200) NOT NULL,
	"schemaVersion" integer NOT NULL,
	"storeId" uuid NOT NULL,
	"sourceModule" varchar(100) NOT NULL,
	"aggregateType" varchar(100) NOT NULL,
	"aggregateId" varchar(255) NOT NULL,
	"aggregateSequence" bigint NOT NULL,
	"occurredAt" timestamp(3) NOT NULL,
	"payload" jsonb NOT NULL,
	"deliveryState" varchar(32) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"nextAttemptAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deliveredAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"moduleId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Passkey" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30) NOT NULL,
	"name" text,
	"publicKey" text NOT NULL,
	"credentialID" text NOT NULL,
	"counter" integer NOT NULL,
	"deviceType" text NOT NULL,
	"backedUp" boolean NOT NULL,
	"transports" text,
	"aaguid" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30) NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"token" text NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"impersonatedBy" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StandingPermission" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"granteeType" varchar(64) NOT NULL,
	"granteeId" varchar(255) NOT NULL,
	"grantee" jsonb NOT NULL,
	"grantorType" varchar(64) NOT NULL,
	"grantorId" varchar(255) NOT NULL,
	"grantor" jsonb NOT NULL,
	"authorityType" varchar(64) NOT NULL,
	"authorityId" varchar(255) NOT NULL,
	"authority" jsonb NOT NULL,
	"businessId" varchar(255) NOT NULL,
	"storeId" varchar(255),
	"actionName" varchar(200) NOT NULL,
	"actionVersion" integer NOT NULL,
	"validFrom" timestamp(3) NOT NULL,
	"validUntil" timestamp(3) NOT NULL,
	"perOperationAmount" numeric(65, 0),
	"aggregateAmount" numeric(65, 0),
	"currency" char(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"revokedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "StandingPermissionUseReservation" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"standingPermissionId" varchar(255) NOT NULL,
	"commandExecutionId" varchar(255) NOT NULL,
	"amount" numeric(65, 0),
	"currency" char(3),
	"state" varchar(32) DEFAULT 'reserved' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30) NOT NULL,
	"slugId" varchar(12) DEFAULT nanoid(12, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'::text) NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phoneNumber" text,
	"phoneNumberVerified" boolean,
	"role" text,
	"banned" boolean DEFAULT false,
	"banReason" text,
	"banExpires" timestamp(3),
	"dateOfBirth" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"iconId" uuid
);
--> statement-breakpoint
CREATE TABLE "Verification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Webhook" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30) NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"events" text[],
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"storeId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "WebhookDelivery" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cuid" varchar(30) NOT NULL,
	"eventType" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) NOT NULL,
	"statusCode" integer,
	"response" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"duration" integer DEFAULT 0 NOT NULL,
	"lastAttemptAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"webhookId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Workflow" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"plane" varchar(32) NOT NULL,
	"name" varchar(200) NOT NULL,
	"state" varchar(32) DEFAULT 'pending' NOT NULL,
	"targetType" varchar(64) NOT NULL,
	"targetId" varchar(255) NOT NULL,
	"target" jsonb NOT NULL,
	"commandExecutionId" varchar(255),
	"currentStep" varchar(200),
	"failure" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "WorkflowAttempt" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"stepId" varchar(255) NOT NULL,
	"attempt" integer NOT NULL,
	"state" varchar(32) DEFAULT 'pending' NOT NULL,
	"operationKey" varchar(500) NOT NULL,
	"providerReference" varchar(500),
	"failure" jsonb,
	"startedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"finishedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "WorkflowStep" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"workflowId" varchar(255) NOT NULL,
	"name" varchar(200) NOT NULL,
	"position" integer NOT NULL,
	"state" varchar(32) DEFAULT 'pending' NOT NULL,
	"providerReference" varchar(500),
	"failure" jsonb,
	"leaseOwner" varchar(255),
	"leaseExpiresAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completedAt" timestamp(3)
);
--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_changeSetId_fkey" FOREIGN KEY ("changeSetId") REFERENCES "public"."ChangeSet"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_commandExecutionId_fkey" FOREIGN KEY ("commandExecutionId") REFERENCES "public"."CommandExecution"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ChangeSet" ADD CONSTRAINT "ChangeSet_supersedesChangeSetId_fkey" FOREIGN KEY ("supersedesChangeSetId") REFERENCES "public"."ChangeSet"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CommandExecution" ADD CONSTRAINT "CommandExecution_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "public"."Approval"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CommandExecution" ADD CONSTRAINT "CommandExecution_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "public"."Confirmation"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "File" ADD CONSTRAINT "File_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Log" ADD CONSTRAINT "Log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Log" ADD CONSTRAINT "Log_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Log" ADD CONSTRAINT "Log_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Log" ADD CONSTRAINT "Log_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Log" ADD CONSTRAINT "Log_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "public"."Invitation"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ModuleData" ADD CONSTRAINT "ModuleData_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "public"."Module"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ModuleData" ADD CONSTRAINT "ModuleData_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."ModuleData"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ModuleEventConsumption" ADD CONSTRAINT "ModuleEventConsumption_consumer_eventId_fkey" FOREIGN KEY ("consumer","eventId") REFERENCES "public"."ModuleEventDelivery"("consumer","eventId") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "ModuleEventDelivery" ADD CONSTRAINT "ModuleEventDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."ModuleOutboxEvent"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "ModuleEventSequence" ADD CONSTRAINT "ModuleEventSequence_storeId_sourceModule_fkey" FOREIGN KEY ("storeId","sourceModule") REFERENCES "public"."Module"("storeId","name") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "ModuleOutboxEvent" ADD CONSTRAINT "ModuleOutboxEvent_moduleId_storeId_sourceModule_fkey" FOREIGN KEY ("moduleId","storeId","sourceModule") REFERENCES "public"."Module"("id","storeId","name") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "StandingPermissionUseReservation" ADD CONSTRAINT "StandingPermissionUseReservation_standingPermissionId_fkey" FOREIGN KEY ("standingPermissionId") REFERENCES "public"."StandingPermission"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "StandingPermissionUseReservation" ADD CONSTRAINT "StandingPermissionUseReservation_commandExecutionId_fkey" FOREIGN KEY ("commandExecutionId") REFERENCES "public"."CommandExecution"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "public"."File"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "public"."Webhook"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_commandExecutionId_fkey" FOREIGN KEY ("commandExecutionId") REFERENCES "public"."CommandExecution"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "WorkflowAttempt" ADD CONSTRAINT "WorkflowAttempt_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "public"."WorkflowStep"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Account_cuid_key" ON "Account" USING btree ("cuid");--> statement-breakpoint
CREATE UNIQUE INDEX "Account_id_key" ON "Account" USING btree ("id");--> statement-breakpoint
CREATE INDEX "Account_userId_idx" ON "Account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Approval_actorType_actorId_approvedAt_idx" ON "Approval" USING btree ("actorType","actorId","approvedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Approval_changeSetId_reviewHash_actorType_actorId_key" ON "Approval" USING btree ("changeSetId","reviewHash","actorType","actorId");--> statement-breakpoint
CREATE INDEX "AuditEvent_actorType_actorId_occurredAt_idx" ON "AuditEvent" USING btree ("actorType","actorId","occurredAt");--> statement-breakpoint
CREATE INDEX "AuditEvent_commandExecutionId_idx" ON "AuditEvent" USING btree ("commandExecutionId");--> statement-breakpoint
CREATE INDEX "AuditEvent_plane_eventType_occurredAt_idx" ON "AuditEvent" USING btree ("plane","eventType","occurredAt");--> statement-breakpoint
CREATE UNIQUE INDEX "AuditEvent_sequence_key" ON "AuditEvent" USING btree ("sequence");--> statement-breakpoint
CREATE INDEX "AuditEvent_targetType_targetId_occurredAt_idx" ON "AuditEvent" USING btree ("targetType","targetId","occurredAt");--> statement-breakpoint
CREATE INDEX "AuditEvent_workflowId_idx" ON "AuditEvent" USING btree ("workflowId");--> statement-breakpoint
CREATE INDEX "ChangeSet_ownerPlane_targetType_targetId_status_idx" ON "ChangeSet" USING btree ("ownerPlane","targetType","targetId","status");--> statement-breakpoint
CREATE INDEX "ChangeSet_reviewHash_idx" ON "ChangeSet" USING btree ("reviewHash");--> statement-breakpoint
CREATE INDEX "ChangeSet_supersedesChangeSetId_idx" ON "ChangeSet" USING btree ("supersedesChangeSetId");--> statement-breakpoint
CREATE INDEX "CommandExecution_actorType_actorId_createdAt_idx" ON "CommandExecution" USING btree ("actorType","actorId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "CommandExecution_approvalId_key" ON "CommandExecution" USING btree ("approvalId");--> statement-breakpoint
CREATE UNIQUE INDEX "CommandExecution_confirmationId_key" ON "CommandExecution" USING btree ("confirmationId");--> statement-breakpoint
CREATE UNIQUE INDEX "CommandExecution_scope_idempotency_key" ON "CommandExecution" USING btree ("plane","actorType","actorId","targetType","targetId","commandName","commandVersion","idempotencyKey");--> statement-breakpoint
CREATE INDEX "CommandExecution_status_leaseExpiresAt_idx" ON "CommandExecution" USING btree ("status","leaseExpiresAt");--> statement-breakpoint
CREATE INDEX "CommandExecution_targetType_targetId_createdAt_idx" ON "CommandExecution" USING btree ("targetType","targetId","createdAt");--> statement-breakpoint
CREATE INDEX "Confirmation_actorType_actorId_sessionId_expiresAt_idx" ON "Confirmation" USING btree ("actorType","actorId","sessionId","expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Confirmation_nonceDigest_key" ON "Confirmation" USING btree ("nonceDigest");--> statement-breakpoint
CREATE INDEX "Confirmation_targetType_targetId_expiresAt_idx" ON "Confirmation" USING btree ("targetType","targetId","expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "File_cuid_key" ON "File" USING btree ("cuid");--> statement-breakpoint
CREATE UNIQUE INDEX "File_id_key" ON "File" USING btree ("id");--> statement-breakpoint
CREATE INDEX "File_userId_idx" ON "File" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "Invitation_cuid_key" ON "Invitation" USING btree ("cuid");--> statement-breakpoint
CREATE INDEX "Invitation_email_idx" ON "Invitation" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "Invitation_id_key" ON "Invitation" USING btree ("id");--> statement-breakpoint
CREATE INDEX "Log_accountId_idx" ON "Log" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "Log_actorId_idx" ON "Log" USING btree ("actorId");--> statement-breakpoint
CREATE UNIQUE INDEX "Log_cuid_key" ON "Log" USING btree ("cuid");--> statement-breakpoint
CREATE UNIQUE INDEX "Log_id_key" ON "Log" USING btree ("id");--> statement-breakpoint
CREATE INDEX "Log_invitationId_idx" ON "Log" USING btree ("invitationId");--> statement-breakpoint
CREATE INDEX "Log_sessionId_idx" ON "Log" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "Log_targetId_idx" ON "Log" USING btree ("targetId");--> statement-breakpoint
CREATE UNIQUE INDEX "Module_cuid_key" ON "Module" USING btree ("cuid");--> statement-breakpoint
CREATE UNIQUE INDEX "Module_id_key" ON "Module" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "ModuleData_cuid_key" ON "ModuleData" USING btree ("cuid");--> statement-breakpoint
CREATE INDEX "ModuleData_entityType_entityId_idx" ON "ModuleData" USING btree ("entityType","entityId");--> statement-breakpoint
CREATE UNIQUE INDEX "ModuleData_id_key" ON "ModuleData" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "ModuleData_moduleId_entityType_entityId_key" ON "ModuleData" USING btree ("moduleId","entityType","entityId");--> statement-breakpoint
CREATE INDEX "ModuleData_moduleId_entityType_idx" ON "ModuleData" USING btree ("moduleId","entityType");--> statement-breakpoint
CREATE INDEX "ModuleData_moduleId_parentId_idx" ON "ModuleData" USING btree ("moduleId","parentId");--> statement-breakpoint
CREATE INDEX "ModuleEventDelivery_claim_idx" ON "ModuleEventDelivery" USING btree ("consumer","state","nextAttemptAt","eventId");--> statement-breakpoint
CREATE INDEX "ModuleEventDelivery_eventId_idx" ON "ModuleEventDelivery" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "ModuleEventDelivery_lease_idx" ON "ModuleEventDelivery" USING btree ("consumer","state","leaseExpiresAt","eventId");--> statement-breakpoint
CREATE UNIQUE INDEX "ModuleOutboxEvent_aggregate_order_key" ON "ModuleOutboxEvent" USING btree ("storeId","sourceModule","aggregateType","aggregateId","aggregateSequence");--> statement-breakpoint
CREATE INDEX "ModuleOutboxEvent_delivery_claim_idx" ON "ModuleOutboxEvent" USING btree ("deliveryState","nextAttemptAt","occurredAt","id");--> statement-breakpoint
CREATE INDEX "Passkey_credentialID_idx" ON "Passkey" USING btree ("credentialID");--> statement-breakpoint
CREATE UNIQUE INDEX "Passkey_cuid_key" ON "Passkey" USING btree ("cuid");--> statement-breakpoint
CREATE UNIQUE INDEX "Passkey_id_key" ON "Passkey" USING btree ("id");--> statement-breakpoint
CREATE INDEX "Passkey_userId_idx" ON "Passkey" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "Session_cuid_key" ON "Session" USING btree ("cuid");--> statement-breakpoint
CREATE UNIQUE INDEX "Session_id_key" ON "Session" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "Session_token_key" ON "Session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "StandingPermission_scope_idx" ON "StandingPermission" USING btree ("granteeType","granteeId","businessId","storeId","actionName","actionVersion");--> statement-breakpoint
CREATE INDEX "StandingPermission_validUntil_revokedAt_idx" ON "StandingPermission" USING btree ("validUntil","revokedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "StandingPermissionUseReservation_commandExecutionId_key" ON "StandingPermissionUseReservation" USING btree ("commandExecutionId");--> statement-breakpoint
CREATE INDEX "StandingPermissionUseReservation_standingPermissionId_state_idx" ON "StandingPermissionUseReservation" USING btree ("standingPermissionId","state");--> statement-breakpoint
CREATE UNIQUE INDEX "User_cuid_key" ON "User" USING btree ("cuid");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "User_iconId_key" ON "User" USING btree ("iconId");--> statement-breakpoint
CREATE UNIQUE INDEX "User_id_key" ON "User" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User" USING btree ("phoneNumber");--> statement-breakpoint
CREATE UNIQUE INDEX "User_slugId_key" ON "User" USING btree ("slugId");--> statement-breakpoint
CREATE UNIQUE INDEX "Verification_cuid_key" ON "Verification" USING btree ("cuid");--> statement-breakpoint
CREATE UNIQUE INDEX "Verification_id_key" ON "Verification" USING btree ("id");--> statement-breakpoint
CREATE INDEX "Verification_identifier_idx" ON "Verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "Webhook_cuid_key" ON "Webhook" USING btree ("cuid");--> statement-breakpoint
CREATE UNIQUE INDEX "Webhook_id_key" ON "Webhook" USING btree ("id");--> statement-breakpoint
CREATE INDEX "Webhook_storeId_isActive_idx" ON "Webhook" USING btree ("storeId","isActive");--> statement-breakpoint
CREATE UNIQUE INDEX "WebhookDelivery_cuid_key" ON "WebhookDelivery" USING btree ("cuid");--> statement-breakpoint
CREATE INDEX "WebhookDelivery_eventType_idx" ON "WebhookDelivery" USING btree ("eventType");--> statement-breakpoint
CREATE UNIQUE INDEX "WebhookDelivery_id_key" ON "WebhookDelivery" USING btree ("id");--> statement-breakpoint
CREATE INDEX "WebhookDelivery_webhookId_idx" ON "WebhookDelivery" USING btree ("webhookId");--> statement-breakpoint
CREATE INDEX "Workflow_commandExecutionId_idx" ON "Workflow" USING btree ("commandExecutionId");--> statement-breakpoint
CREATE INDEX "Workflow_state_updatedAt_idx" ON "Workflow" USING btree ("state","updatedAt");--> statement-breakpoint
CREATE INDEX "Workflow_targetType_targetId_state_idx" ON "Workflow" USING btree ("targetType","targetId","state");--> statement-breakpoint
CREATE INDEX "WorkflowAttempt_operationKey_idx" ON "WorkflowAttempt" USING btree ("operationKey");--> statement-breakpoint
CREATE INDEX "WorkflowAttempt_state_startedAt_idx" ON "WorkflowAttempt" USING btree ("state","startedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "WorkflowAttempt_stepId_attempt_key" ON "WorkflowAttempt" USING btree ("stepId","attempt");--> statement-breakpoint
CREATE INDEX "WorkflowStep_state_leaseExpiresAt_idx" ON "WorkflowStep" USING btree ("state","leaseExpiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "WorkflowStep_workflowId_position_key" ON "WorkflowStep" USING btree ("workflowId","position");