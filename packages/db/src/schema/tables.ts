import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	bigint,
	bigserial,
	boolean,
	char,
	foreignKey,
	index,
	integer,
	jsonb,
	numeric,
	type PgTableExtraConfigValue,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const session = pgTable(
	"Session",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }).notNull(),
		expiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		token: text().notNull(),
		ipAddress: text(),
		userAgent: text(),
		impersonatedBy: text(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		userId: uuid().notNull(),
	},
	(table) => [
		uniqueIndex("Session_cuid_key").using(
			"btree",
			table.cuid.asc().nullsLast(),
		),
		uniqueIndex("Session_id_key").using("btree", table.id.asc().nullsLast()),
		uniqueIndex("Session_token_key").using(
			"btree",
			table.token.asc().nullsLast(),
		),
		index("Session_userId_idx").using("btree", table.userId.asc().nullsLast()),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Session_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const account = pgTable(
	"Account",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }).notNull(),
		accountId: text().notNull(),
		providerId: text().notNull(),
		accessToken: text(),
		refreshToken: text(),
		idToken: text(),
		accessTokenExpiresAt: timestamp({ precision: 3, mode: "string" }),
		refreshTokenExpiresAt: timestamp({ precision: 3, mode: "string" }),
		scope: text(),
		password: text(),
		metadata: jsonb(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		userId: uuid().notNull(),
	},
	(table) => [
		uniqueIndex("Account_cuid_key").using(
			"btree",
			table.cuid.asc().nullsLast(),
		),
		uniqueIndex("Account_id_key").using("btree", table.id.asc().nullsLast()),
		index("Account_userId_idx").using("btree", table.userId.asc().nullsLast()),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Account_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const passkey = pgTable(
	"Passkey",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }).notNull(),
		name: text(),
		publicKey: text().notNull(),
		credentialID: text("credentialID").notNull(),
		counter: integer().notNull(),
		deviceType: text().notNull(),
		backedUp: boolean().notNull(),
		transports: text(),
		aaguid: text(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		userId: uuid().notNull(),
	},
	(table) => [
		index("Passkey_credentialID_idx").using(
			"btree",
			table.credentialID.asc().nullsLast(),
		),
		uniqueIndex("Passkey_cuid_key").using(
			"btree",
			table.cuid.asc().nullsLast(),
		),
		uniqueIndex("Passkey_id_key").using("btree", table.id.asc().nullsLast()),
		index("Passkey_userId_idx").using("btree", table.userId.asc().nullsLast()),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Passkey_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const invitation = pgTable(
	"Invitation",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }).notNull(),
		email: text().notNull(),
		role: text(),
		status: text().notNull(),
		expiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		inviterId: uuid().notNull(),
	},
	(table) => [
		uniqueIndex("Invitation_cuid_key").using(
			"btree",
			table.cuid.asc().nullsLast(),
		),
		index("Invitation_email_idx").using("btree", table.email.asc().nullsLast()),
		uniqueIndex("Invitation_id_key").using("btree", table.id.asc().nullsLast()),
		foreignKey({
			columns: [table.inviterId],
			foreignColumns: [user.id],
			name: "Invitation_inviterId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const verification = pgTable(
	"Verification",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }),
		identifier: text().notNull(),
		value: text().notNull(),
		expiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		uniqueIndex("Verification_cuid_key").using(
			"btree",
			table.cuid.asc().nullsLast(),
		),
		uniqueIndex("Verification_id_key").using(
			"btree",
			table.id.asc().nullsLast(),
		),
		index("Verification_identifier_idx").using(
			"btree",
			table.identifier.asc().nullsLast(),
		),
	],
);

export const commandExecution = pgTable(
	"CommandExecution",
	{
		id: varchar({ length: 255 }).primaryKey().notNull(),
		plane: varchar({ length: 32 }).notNull(),
		commandName: varchar({ length: 200 }).notNull(),
		commandVersion: integer().notNull(),
		actionLevel: varchar({ length: 32 }).notNull(),
		idempotencyKey: varchar({ length: 200 }).notNull(),
		requestDigestVersion: integer().default(1).notNull(),
		inputDigest: char({ length: 64 }).notNull(),
		commandBindingHashVersion: integer(),
		commandBindingHash: char({ length: 64 }),
		grantUse: jsonb(),
		redactedInput: jsonb().notNull(),
		actorType: varchar({ length: 64 }).notNull(),
		actorId: varchar({ length: 255 }).notNull(),
		actor: jsonb().notNull(),
		authorityType: varchar({ length: 64 }).notNull(),
		authorityId: varchar({ length: 255 }).notNull(),
		authority: jsonb().notNull(),
		targetType: varchar({ length: 64 }).notNull(),
		targetId: varchar({ length: 255 }).notNull(),
		target: jsonb().notNull(),
		approvalId: varchar({ length: 255 }),
		confirmationId: varchar({ length: 255 }),
		status: varchar({ length: 32 }).default("pending").notNull(),
		result: jsonb(),
		failure: jsonb(),
		leaseOwner: varchar({ length: 255 }),
		leaseExpiresAt: timestamp({ precision: 3, mode: "string" }),
		startedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		completedAt: timestamp({ precision: 3, mode: "string" }),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("CommandExecution_actorType_actorId_createdAt_idx").using(
			"btree",
			table.actorType.asc().nullsLast(),
			table.actorId.asc().nullsLast(),
			table.createdAt.asc().nullsLast(),
		),
		uniqueIndex("CommandExecution_approvalId_key").using(
			"btree",
			table.approvalId.asc().nullsLast(),
		),
		uniqueIndex("CommandExecution_confirmationId_key").using(
			"btree",
			table.confirmationId.asc().nullsLast(),
		),
		uniqueIndex("CommandExecution_scope_idempotency_key").using(
			"btree",
			table.plane.asc().nullsLast(),
			table.actorType.asc().nullsLast(),
			table.actorId.asc().nullsLast(),
			table.targetType.asc().nullsLast(),
			table.targetId.asc().nullsLast(),
			table.commandName.asc().nullsLast(),
			table.commandVersion.asc().nullsLast(),
			table.idempotencyKey.asc().nullsLast(),
		),
		index("CommandExecution_status_leaseExpiresAt_idx").using(
			"btree",
			table.status.asc().nullsLast(),
			table.leaseExpiresAt.asc().nullsLast(),
		),
		index("CommandExecution_targetType_targetId_createdAt_idx").using(
			"btree",
			table.targetType.asc().nullsLast(),
			table.targetId.asc().nullsLast(),
			table.createdAt.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.approvalId],
			foreignColumns: [approval.id],
			name: "CommandExecution_approvalId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
		foreignKey({
			columns: [table.confirmationId],
			foreignColumns: [confirmation.id],
			name: "CommandExecution_confirmationId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const auditEvent = pgTable(
	"AuditEvent",
	{
		id: varchar({ length: 255 }).primaryKey().notNull(),
		sequence: bigserial({ mode: "bigint" }).notNull(),
		version: integer().notNull(),
		plane: varchar({ length: 32 }).notNull(),
		eventType: varchar({ length: 200 }).notNull(),
		actorType: varchar({ length: 64 }).notNull(),
		actorId: varchar({ length: 255 }).notNull(),
		actor: jsonb().notNull(),
		authorityType: varchar({ length: 64 }).notNull(),
		authorityId: varchar({ length: 255 }).notNull(),
		authority: jsonb().notNull(),
		targetType: varchar({ length: 64 }).notNull(),
		targetId: varchar({ length: 255 }).notNull(),
		target: jsonb().notNull(),
		commandName: varchar({ length: 200 }),
		commandVersion: integer(),
		commandExecutionId: varchar({ length: 255 }),
		workflowId: varchar({ length: 255 }),
		occurredAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		data: jsonb().notNull(),
	},
	(table) => [
		index("AuditEvent_actorType_actorId_occurredAt_idx").using(
			"btree",
			table.actorType.asc().nullsLast(),
			table.actorId.asc().nullsLast(),
			table.occurredAt.asc().nullsLast(),
		),
		index("AuditEvent_commandExecutionId_idx").using(
			"btree",
			table.commandExecutionId.asc().nullsLast(),
		),
		index("AuditEvent_plane_eventType_occurredAt_idx").using(
			"btree",
			table.plane.asc().nullsLast(),
			table.eventType.asc().nullsLast(),
			table.occurredAt.asc().nullsLast(),
		),
		uniqueIndex("AuditEvent_sequence_key").using(
			"btree",
			table.sequence.asc().nullsLast(),
		),
		index("AuditEvent_targetType_targetId_occurredAt_idx").using(
			"btree",
			table.targetType.asc().nullsLast(),
			table.targetId.asc().nullsLast(),
			table.occurredAt.asc().nullsLast(),
		),
		index("AuditEvent_workflowId_idx").using(
			"btree",
			table.workflowId.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.commandExecutionId],
			foreignColumns: [commandExecution.id],
			name: "AuditEvent_commandExecutionId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
		foreignKey({
			columns: [table.workflowId],
			foreignColumns: [workflow.id],
			name: "AuditEvent_workflowId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const workflow = pgTable(
	"Workflow",
	{
		id: varchar({ length: 255 }).primaryKey().notNull(),
		version: integer().notNull(),
		plane: varchar({ length: 32 }).notNull(),
		name: varchar({ length: 200 }).notNull(),
		state: varchar({ length: 32 }).default("pending").notNull(),
		targetType: varchar({ length: 64 }).notNull(),
		targetId: varchar({ length: 255 }).notNull(),
		target: jsonb().notNull(),
		commandExecutionId: varchar({ length: 255 }),
		currentStep: varchar({ length: 200 }),
		failure: jsonb(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		completedAt: timestamp({ precision: 3, mode: "string" }),
	},
	(table) => [
		index("Workflow_commandExecutionId_idx").using(
			"btree",
			table.commandExecutionId.asc().nullsLast(),
		),
		index("Workflow_state_updatedAt_idx").using(
			"btree",
			table.state.asc().nullsLast(),
			table.updatedAt.asc().nullsLast(),
		),
		index("Workflow_targetType_targetId_state_idx").using(
			"btree",
			table.targetType.asc().nullsLast(),
			table.targetId.asc().nullsLast(),
			table.state.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.commandExecutionId],
			foreignColumns: [commandExecution.id],
			name: "Workflow_commandExecutionId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const user = pgTable(
	"User",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }).notNull(),
		// nanoid() is supplied by migration 0 (Viascom, Apache-2.0). Introspection
		// cannot express a function call default, so it is a raw SQL default here.
		slugId: varchar({ length: 12 })
			.default(
				sql`nanoid(12, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'::text)`,
			)
			.notNull(),
		name: text(),
		email: text().notNull(),
		emailVerified: boolean().default(false).notNull(),
		image: text(),
		phoneNumber: text(),
		phoneNumberVerified: boolean(),
		role: text(),
		banned: boolean().default(false),
		banReason: text(),
		banExpires: timestamp({ precision: 3, mode: "string" }),
		dateOfBirth: timestamp({ precision: 3, mode: "string" }),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		iconId: uuid(),
	},
	(table): PgTableExtraConfigValue[] => [
		uniqueIndex("User_cuid_key").using("btree", table.cuid.asc().nullsLast()),
		uniqueIndex("User_email_key").using("btree", table.email.asc().nullsLast()),
		uniqueIndex("User_iconId_key").using(
			"btree",
			table.iconId.asc().nullsLast(),
		),
		uniqueIndex("User_id_key").using("btree", table.id.asc().nullsLast()),
		uniqueIndex("User_phoneNumber_key").using(
			"btree",
			table.phoneNumber.asc().nullsLast(),
		),
		uniqueIndex("User_slugId_key").using(
			"btree",
			table.slugId.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.iconId],
			foreignColumns: [file.id as AnyPgColumn],
			name: "User_iconId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
	],
);

export const workflowAttempt = pgTable(
	"WorkflowAttempt",
	{
		id: varchar({ length: 255 }).primaryKey().notNull(),
		stepId: varchar({ length: 255 }).notNull(),
		attempt: integer().notNull(),
		state: varchar({ length: 32 }).default("pending").notNull(),
		operationKey: varchar({ length: 500 }).notNull(),
		providerReference: varchar({ length: 500 }),
		failure: jsonb(),
		startedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		finishedAt: timestamp({ precision: 3, mode: "string" }),
	},
	(table) => [
		index("WorkflowAttempt_operationKey_idx").using(
			"btree",
			table.operationKey.asc().nullsLast(),
		),
		index("WorkflowAttempt_state_startedAt_idx").using(
			"btree",
			table.state.asc().nullsLast(),
			table.startedAt.asc().nullsLast(),
		),
		uniqueIndex("WorkflowAttempt_stepId_attempt_key").using(
			"btree",
			table.stepId.asc().nullsLast(),
			table.attempt.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.stepId],
			foreignColumns: [workflowStep.id],
			name: "WorkflowAttempt_stepId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const changeSet = pgTable(
	"ChangeSet",
	{
		id: varchar({ length: 255 }).primaryKey().notNull(),
		version: integer().notNull(),
		changeSetHashVersion: integer().default(1).notNull(),
		ownerPlane: varchar({ length: 32 }).notNull(),
		status: varchar({ length: 32 }).default("draft").notNull(),
		reviewHash: char({ length: 64 }).notNull(),
		targetType: varchar({ length: 64 }).notNull(),
		targetId: varchar({ length: 255 }).notNull(),
		target: jsonb().notNull(),
		proposal: jsonb().notNull(),
		supersedesChangeSetId: varchar({ length: 255 }),
		baseRevisions: jsonb().notNull(),
		affectedTargets: jsonb().notNull(),
		beforeSummary: jsonb().notNull(),
		afterSummary: jsonb().notNull(),
		publicEffects: jsonb().notNull(),
		operationalEffects: jsonb().notNull(),
		estimatedCharges: jsonb().notNull(),
		requiredPermissions: jsonb().notNull(),
		validationBlocks: jsonb().notNull(),
		rollbackCoverage: varchar({ length: 32 }).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		immutableAt: timestamp({ precision: 3, mode: "string" }),
	},
	(table) => [
		index("ChangeSet_ownerPlane_targetType_targetId_status_idx").using(
			"btree",
			table.ownerPlane.asc().nullsLast(),
			table.targetType.asc().nullsLast(),
			table.targetId.asc().nullsLast(),
			table.status.asc().nullsLast(),
		),
		index("ChangeSet_reviewHash_idx").using(
			"btree",
			table.reviewHash.asc().nullsLast(),
		),
		index("ChangeSet_supersedesChangeSetId_idx").using(
			"btree",
			table.supersedesChangeSetId.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.supersedesChangeSetId],
			foreignColumns: [table.id],
			name: "ChangeSet_supersedesChangeSetId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const workflowStep = pgTable(
	"WorkflowStep",
	{
		id: varchar({ length: 255 }).primaryKey().notNull(),
		workflowId: varchar({ length: 255 }).notNull(),
		name: varchar({ length: 200 }).notNull(),
		position: integer().notNull(),
		state: varchar({ length: 32 }).default("pending").notNull(),
		providerReference: varchar({ length: 500 }),
		failure: jsonb(),
		leaseOwner: varchar({ length: 255 }),
		leaseExpiresAt: timestamp({ precision: 3, mode: "string" }),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		completedAt: timestamp({ precision: 3, mode: "string" }),
	},
	(table) => [
		index("WorkflowStep_state_leaseExpiresAt_idx").using(
			"btree",
			table.state.asc().nullsLast(),
			table.leaseExpiresAt.asc().nullsLast(),
		),
		uniqueIndex("WorkflowStep_workflowId_position_key").using(
			"btree",
			table.workflowId.asc().nullsLast(),
			table.position.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.workflowId],
			foreignColumns: [workflow.id],
			name: "WorkflowStep_workflowId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const approval = pgTable(
	"Approval",
	{
		id: varchar({ length: 255 }).primaryKey().notNull(),
		changeSetId: varchar({ length: 255 }).notNull(),
		reviewHash: char({ length: 64 }).notNull(),
		baseRevisions: jsonb().notNull(),
		actorType: varchar({ length: 64 }).notNull(),
		actorId: varchar({ length: 255 }).notNull(),
		actor: jsonb().notNull(),
		authorityType: varchar({ length: 64 }).notNull(),
		authorityId: varchar({ length: 255 }).notNull(),
		authority: jsonb().notNull(),
		approvedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		invalidatedAt: timestamp({ precision: 3, mode: "string" }),
	},
	(table) => [
		index("Approval_actorType_actorId_approvedAt_idx").using(
			"btree",
			table.actorType.asc().nullsLast(),
			table.actorId.asc().nullsLast(),
			table.approvedAt.asc().nullsLast(),
		),
		uniqueIndex("Approval_changeSetId_reviewHash_actorType_actorId_key").using(
			"btree",
			table.changeSetId.asc().nullsLast(),
			table.reviewHash.asc().nullsLast(),
			table.actorType.asc().nullsLast(),
			table.actorId.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.changeSetId],
			foreignColumns: [changeSet.id],
			name: "Approval_changeSetId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const confirmation = pgTable(
	"Confirmation",
	{
		id: varchar({ length: 255 }).primaryKey().notNull(),
		actorType: varchar({ length: 64 }).notNull(),
		actorId: varchar({ length: 255 }).notNull(),
		actor: jsonb().notNull(),
		sessionId: varchar({ length: 255 }).notNull(),
		targetType: varchar({ length: 64 }).notNull(),
		targetId: varchar({ length: 255 }).notNull(),
		target: jsonb().notNull(),
		commandName: varchar({ length: 200 }).notNull(),
		commandVersion: integer().notNull(),
		bindingHashVersion: integer().notNull(),
		bindingHash: char({ length: 64 }).notNull(),
		nonceDigest: char({ length: 64 }).notNull(),
		disclosure: text().notNull(),
		amount: numeric({ precision: 65, scale: 0 }),
		currency: char({ length: 3 }),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		expiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		consumedAt: timestamp({ precision: 3, mode: "string" }),
	},
	(table) => [
		index("Confirmation_actorType_actorId_sessionId_expiresAt_idx").using(
			"btree",
			table.actorType.asc().nullsLast(),
			table.actorId.asc().nullsLast(),
			table.sessionId.asc().nullsLast(),
			table.expiresAt.asc().nullsLast(),
		),
		uniqueIndex("Confirmation_nonceDigest_key").using(
			"btree",
			table.nonceDigest.asc().nullsLast(),
		),
		index("Confirmation_targetType_targetId_expiresAt_idx").using(
			"btree",
			table.targetType.asc().nullsLast(),
			table.targetId.asc().nullsLast(),
			table.expiresAt.asc().nullsLast(),
		),
	],
);

export const log = pgTable(
	"Log",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }).notNull(),
		action: text().notNull(),
		data: jsonb(),
		timestamp: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		actorId: uuid(),
		targetId: uuid(),
		accountId: uuid(),
		sessionId: uuid(),
		invitationId: uuid(),
	},
	(table) => [
		index("Log_accountId_idx").using(
			"btree",
			table.accountId.asc().nullsLast(),
		),
		index("Log_actorId_idx").using("btree", table.actorId.asc().nullsLast()),
		uniqueIndex("Log_cuid_key").using("btree", table.cuid.asc().nullsLast()),
		uniqueIndex("Log_id_key").using("btree", table.id.asc().nullsLast()),
		index("Log_invitationId_idx").using(
			"btree",
			table.invitationId.asc().nullsLast(),
		),
		index("Log_sessionId_idx").using(
			"btree",
			table.sessionId.asc().nullsLast(),
		),
		index("Log_targetId_idx").using("btree", table.targetId.asc().nullsLast()),
		foreignKey({
			columns: [table.actorId],
			foreignColumns: [user.id],
			name: "Log_actorId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.targetId],
			foreignColumns: [user.id],
			name: "Log_targetId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.accountId],
			foreignColumns: [account.id],
			name: "Log_accountId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.sessionId],
			foreignColumns: [session.id],
			name: "Log_sessionId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.invitationId],
			foreignColumns: [invitation.id],
			name: "Log_invitationId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
	],
);

export const module = pgTable(
	"Module",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }).notNull(),
		name: text().notNull(),
		version: text().notNull(),
		isEnabled: boolean().default(true).notNull(),
		settings: jsonb(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		store: jsonb(),
		storeId: uuid(),
	},
	(table) => [
		uniqueIndex("Module_cuid_key").using("btree", table.cuid.asc().nullsLast()),
		uniqueIndex("Module_id_key").using("btree", table.id.asc().nullsLast()),
		// Introspection dropped both of these. They are the unique constraints the
		// outbox foreign keys reference, so without them ModuleEventSequence and
		// ModuleOutboxEvent lose their integrity guarantee against Module.
		unique("Module_storeId_name_key").on(table.storeId, table.name),
		unique("Module_outbox_owner_key").on(table.id, table.storeId, table.name),
	],
);

export const moduleOutboxEvent = pgTable(
	"ModuleOutboxEvent",
	{
		id: uuid().primaryKey().notNull(),
		eventType: varchar({ length: 200 }).notNull(),
		schemaVersion: integer().notNull(),
		storeId: uuid().notNull(),
		sourceModule: varchar({ length: 100 }).notNull(),
		aggregateType: varchar({ length: 100 }).notNull(),
		aggregateId: varchar({ length: 255 }).notNull(),
		// You can use { mode: "bigint" } if numbers are exceeding js number limitations
		aggregateSequence: bigint({ mode: "number" }).notNull(),
		occurredAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		payload: jsonb().notNull(),
		deliveryState: varchar({ length: 32 }).default("pending").notNull(),
		attempts: integer().default(0).notNull(),
		nextAttemptAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		deliveredAt: timestamp({ precision: 3, mode: "string" }),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		moduleId: uuid().notNull(),
	},
	(table) => [
		uniqueIndex("ModuleOutboxEvent_aggregate_order_key").using(
			"btree",
			table.storeId.asc().nullsLast(),
			table.sourceModule.asc().nullsLast(),
			table.aggregateType.asc().nullsLast(),
			table.aggregateId.asc().nullsLast(),
			table.aggregateSequence.asc().nullsLast(),
		),
		index("ModuleOutboxEvent_delivery_claim_idx").using(
			"btree",
			table.deliveryState.asc().nullsLast(),
			table.nextAttemptAt.asc().nullsLast(),
			table.occurredAt.asc().nullsLast(),
			table.id.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.moduleId, table.storeId, table.sourceModule],
			foreignColumns: [module.id, module.storeId, module.name],
			name: "ModuleOutboxEvent_moduleId_storeId_sourceModule_fkey",
		})
			.onUpdate("restrict")
			.onDelete("restrict"),
	],
);

export const standingPermission = pgTable(
	"StandingPermission",
	{
		id: varchar({ length: 255 }).primaryKey().notNull(),
		granteeType: varchar({ length: 64 }).notNull(),
		granteeId: varchar({ length: 255 }).notNull(),
		grantee: jsonb().notNull(),
		grantorType: varchar({ length: 64 }).notNull(),
		grantorId: varchar({ length: 255 }).notNull(),
		grantor: jsonb().notNull(),
		authorityType: varchar({ length: 64 }).notNull(),
		authorityId: varchar({ length: 255 }).notNull(),
		authority: jsonb().notNull(),
		businessId: varchar({ length: 255 }).notNull(),
		storeId: varchar({ length: 255 }),
		actionName: varchar({ length: 200 }).notNull(),
		actionVersion: integer().notNull(),
		validFrom: timestamp({ precision: 3, mode: "string" }).notNull(),
		validUntil: timestamp({ precision: 3, mode: "string" }).notNull(),
		perOperationAmount: numeric({ precision: 65, scale: 0 }),
		aggregateAmount: numeric({ precision: 65, scale: 0 }),
		currency: char({ length: 3 }),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		revokedAt: timestamp({ precision: 3, mode: "string" }),
	},
	(table) => [
		index("StandingPermission_scope_idx").using(
			"btree",
			table.granteeType.asc().nullsLast(),
			table.granteeId.asc().nullsLast(),
			table.businessId.asc().nullsLast(),
			table.storeId.asc().nullsLast(),
			table.actionName.asc().nullsLast(),
			table.actionVersion.asc().nullsLast(),
		),
		index("StandingPermission_validUntil_revokedAt_idx").using(
			"btree",
			table.validUntil.asc().nullsLast(),
			table.revokedAt.asc().nullsLast(),
		),
	],
);

export const moduleData = pgTable(
	"ModuleData",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }).notNull(),
		entityType: varchar({ length: 100 }).notNull(),
		entityId: varchar({ length: 255 }).notNull(),
		data: jsonb(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		moduleId: uuid().notNull(),
		parentId: uuid(),
	},
	(table) => [
		uniqueIndex("ModuleData_cuid_key").using(
			"btree",
			table.cuid.asc().nullsLast(),
		),
		index("ModuleData_entityType_entityId_idx").using(
			"btree",
			table.entityType.asc().nullsLast(),
			table.entityId.asc().nullsLast(),
		),
		uniqueIndex("ModuleData_id_key").using("btree", table.id.asc().nullsLast()),
		uniqueIndex("ModuleData_moduleId_entityType_entityId_key").using(
			"btree",
			table.moduleId.asc().nullsLast(),
			table.entityType.asc().nullsLast(),
			table.entityId.asc().nullsLast(),
		),
		index("ModuleData_moduleId_entityType_idx").using(
			"btree",
			table.moduleId.asc().nullsLast(),
			table.entityType.asc().nullsLast(),
		),
		index("ModuleData_moduleId_parentId_idx").using(
			"btree",
			table.moduleId.asc().nullsLast(),
			table.parentId.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.moduleId],
			foreignColumns: [module.id],
			name: "ModuleData_moduleId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "ModuleData_parentId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const file = pgTable(
	"File",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }).notNull(),
		name: text(),
		description: text(),
		url: text().notNull(),
		mediaType: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		userId: uuid().notNull(),
	},
	(table): PgTableExtraConfigValue[] => [
		uniqueIndex("File_cuid_key").using("btree", table.cuid.asc().nullsLast()),
		uniqueIndex("File_id_key").using("btree", table.id.asc().nullsLast()),
		index("File_userId_idx").using("btree", table.userId.asc().nullsLast()),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "File_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const standingPermissionUseReservation = pgTable(
	"StandingPermissionUseReservation",
	{
		id: varchar({ length: 255 }).primaryKey().notNull(),
		standingPermissionId: varchar({ length: 255 }).notNull(),
		commandExecutionId: varchar({ length: 255 }).notNull(),
		amount: numeric({ precision: 65, scale: 0 }),
		currency: char({ length: 3 }),
		state: varchar({ length: 32 }).default("reserved").notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		uniqueIndex(
			"StandingPermissionUseReservation_commandExecutionId_key",
		).using("btree", table.commandExecutionId.asc().nullsLast()),
		index(
			"StandingPermissionUseReservation_standingPermissionId_state_idx",
		).using(
			"btree",
			table.standingPermissionId.asc().nullsLast(),
			table.state.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.standingPermissionId],
			foreignColumns: [standingPermission.id],
			name: "StandingPermissionUseReservation_standingPermissionId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
		foreignKey({
			columns: [table.commandExecutionId],
			foreignColumns: [commandExecution.id],
			name: "StandingPermissionUseReservation_commandExecutionId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const webhook = pgTable(
	"Webhook",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }).notNull(),
		url: text().notNull(),
		secret: text().notNull(),
		isActive: boolean().default(true).notNull(),
		events: text().array(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		storeId: uuid().notNull(),
	},
	(table) => [
		uniqueIndex("Webhook_cuid_key").using(
			"btree",
			table.cuid.asc().nullsLast(),
		),
		uniqueIndex("Webhook_id_key").using("btree", table.id.asc().nullsLast()),
		index("Webhook_storeId_isActive_idx").using(
			"btree",
			table.storeId.asc().nullsLast(),
			table.isActive.asc().nullsLast(),
		),
	],
);

export const webhookDelivery = pgTable(
	"WebhookDelivery",
	{
		id: uuid().primaryKey().notNull(),
		cuid: varchar({ length: 30 }).notNull(),
		eventType: text().notNull(),
		payload: jsonb().notNull(),
		status: varchar({ length: 20 }).notNull(),
		statusCode: integer(),
		response: text(),
		attempts: integer().default(1).notNull(),
		duration: integer().default(0).notNull(),
		lastAttemptAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		webhookId: uuid().notNull(),
	},
	(table) => [
		uniqueIndex("WebhookDelivery_cuid_key").using(
			"btree",
			table.cuid.asc().nullsLast(),
		),
		index("WebhookDelivery_eventType_idx").using(
			"btree",
			table.eventType.asc().nullsLast(),
		),
		uniqueIndex("WebhookDelivery_id_key").using(
			"btree",
			table.id.asc().nullsLast(),
		),
		index("WebhookDelivery_webhookId_idx").using(
			"btree",
			table.webhookId.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.webhookId],
			foreignColumns: [webhook.id],
			name: "WebhookDelivery_webhookId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const moduleEventConsumption = pgTable(
	"ModuleEventConsumption",
	{
		consumer: varchar({ length: 200 }).notNull(),
		eventId: uuid().notNull(),
		consumedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.consumer, table.eventId],
			foreignColumns: [
				moduleEventDelivery.consumer,
				moduleEventDelivery.eventId,
			],
			name: "ModuleEventConsumption_consumer_eventId_fkey",
		})
			.onUpdate("restrict")
			.onDelete("restrict"),
		primaryKey({
			columns: [table.consumer, table.eventId],
			name: "ModuleEventConsumption_pkey",
		}),
	],
);

export const moduleEventSequence = pgTable(
	"ModuleEventSequence",
	{
		storeId: uuid().notNull(),
		sourceModule: varchar({ length: 100 }).notNull(),
		aggregateType: varchar({ length: 100 }).notNull(),
		aggregateId: varchar({ length: 255 }).notNull(),
		// You can use { mode: "bigint" } if numbers are exceeding js number limitations
		lastSequence: bigint({ mode: "number" }).notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.storeId, table.sourceModule],
			foreignColumns: [module.storeId, module.name],
			name: "ModuleEventSequence_storeId_sourceModule_fkey",
		})
			.onUpdate("restrict")
			.onDelete("restrict"),
		primaryKey({
			columns: [
				table.storeId,
				table.sourceModule,
				table.aggregateType,
				table.aggregateId,
			],
			name: "ModuleEventSequence_pkey",
		}),
	],
);

export const moduleEventDelivery = pgTable(
	"ModuleEventDelivery",
	{
		eventId: uuid().notNull(),
		consumer: varchar({ length: 200 }).notNull(),
		state: varchar({ length: 32 }).default("pending").notNull(),
		attempts: integer().default(0).notNull(),
		nextAttemptAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		leaseToken: uuid(),
		leaseOwner: varchar({ length: 200 }),
		leaseExpiresAt: timestamp({ precision: 3, mode: "string" }),
		lastError: varchar({ length: 500 }),
		succeededAt: timestamp({ precision: 3, mode: "string" }),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("ModuleEventDelivery_claim_idx").using(
			"btree",
			table.consumer.asc().nullsLast(),
			table.state.asc().nullsLast(),
			table.nextAttemptAt.asc().nullsLast(),
			table.eventId.asc().nullsLast(),
		),
		index("ModuleEventDelivery_eventId_idx").using(
			"btree",
			table.eventId.asc().nullsLast(),
		),
		index("ModuleEventDelivery_lease_idx").using(
			"btree",
			table.consumer.asc().nullsLast(),
			table.state.asc().nullsLast(),
			table.leaseExpiresAt.asc().nullsLast(),
			table.eventId.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.eventId],
			foreignColumns: [moduleOutboxEvent.id],
			name: "ModuleEventDelivery_eventId_fkey",
		})
			.onUpdate("restrict")
			.onDelete("restrict"),
		primaryKey({
			columns: [table.consumer, table.eventId],
			name: "ModuleEventDelivery_pkey",
		}),
	],
);
