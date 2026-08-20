import { relations } from "drizzle-orm/relations";
import {
	account,
	approval,
	auditEvent,
	changeSet,
	commandExecution,
	confirmation,
	file,
	invitation,
	log,
	module,
	moduleData,
	moduleEventConsumption,
	moduleEventDelivery,
	moduleEventSequence,
	moduleOutboxEvent,
	passkey,
	session,
	standingPermission,
	standingPermissionUseReservation,
	user,
	webhook,
	webhookDelivery,
	workflow,
	workflowAttempt,
	workflowStep,
} from "./tables";

export const sessionRelations = relations(session, ({ one, many }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
	logs: many(log),
}));

export const userRelations = relations(user, ({ one, many }) => ({
	sessions: many(session),
	accounts: many(account),
	passkeys: many(passkey),
	invitations: many(invitation),
	file: one(file, {
		fields: [user.iconId],
		references: [file.id],
		relationName: "user_iconId_file_id",
	}),
	logs_actorId: many(log, {
		relationName: "log_actorId_user_id",
	}),
	logs_targetId: many(log, {
		relationName: "log_targetId_user_id",
	}),
	files: many(file, {
		relationName: "file_userId_user_id",
	}),
}));

export const accountRelations = relations(account, ({ one, many }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
	logs: many(log),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
	user: one(user, {
		fields: [passkey.userId],
		references: [user.id],
	}),
}));

export const invitationRelations = relations(invitation, ({ one, many }) => ({
	user: one(user, {
		fields: [invitation.inviterId],
		references: [user.id],
	}),
	logs: many(log),
}));

export const commandExecutionRelations = relations(
	commandExecution,
	({ one, many }) => ({
		approval: one(approval, {
			fields: [commandExecution.approvalId],
			references: [approval.id],
		}),
		confirmation: one(confirmation, {
			fields: [commandExecution.confirmationId],
			references: [confirmation.id],
		}),
		auditEvents: many(auditEvent),
		workflows: many(workflow),
		standingPermissionUseReservations: many(standingPermissionUseReservation),
	}),
);

export const approvalRelations = relations(approval, ({ one, many }) => ({
	commandExecutions: many(commandExecution),
	changeSet: one(changeSet, {
		fields: [approval.changeSetId],
		references: [changeSet.id],
	}),
}));

export const confirmationRelations = relations(confirmation, ({ many }) => ({
	commandExecutions: many(commandExecution),
}));

export const auditEventRelations = relations(auditEvent, ({ one }) => ({
	commandExecution: one(commandExecution, {
		fields: [auditEvent.commandExecutionId],
		references: [commandExecution.id],
	}),
	workflow: one(workflow, {
		fields: [auditEvent.workflowId],
		references: [workflow.id],
	}),
}));

export const workflowRelations = relations(workflow, ({ one, many }) => ({
	auditEvents: many(auditEvent),
	commandExecution: one(commandExecution, {
		fields: [workflow.commandExecutionId],
		references: [commandExecution.id],
	}),
	workflowSteps: many(workflowStep),
}));

export const fileRelations = relations(file, ({ one, many }) => ({
	users: many(user, {
		relationName: "user_iconId_file_id",
	}),
	user: one(user, {
		fields: [file.userId],
		references: [user.id],
		relationName: "file_userId_user_id",
	}),
}));

export const workflowAttemptRelations = relations(
	workflowAttempt,
	({ one }) => ({
		workflowStep: one(workflowStep, {
			fields: [workflowAttempt.stepId],
			references: [workflowStep.id],
		}),
	}),
);

export const workflowStepRelations = relations(
	workflowStep,
	({ one, many }) => ({
		workflowAttempts: many(workflowAttempt),
		workflow: one(workflow, {
			fields: [workflowStep.workflowId],
			references: [workflow.id],
		}),
	}),
);

export const changeSetRelations = relations(changeSet, ({ one, many }) => ({
	changeSet: one(changeSet, {
		fields: [changeSet.supersedesChangeSetId],
		references: [changeSet.id],
		relationName: "changeSet_supersedesChangeSetId_changeSet_id",
	}),
	changeSets: many(changeSet, {
		relationName: "changeSet_supersedesChangeSetId_changeSet_id",
	}),
	approvals: many(approval),
}));

export const logRelations = relations(log, ({ one }) => ({
	user_actorId: one(user, {
		fields: [log.actorId],
		references: [user.id],
		relationName: "log_actorId_user_id",
	}),
	user_targetId: one(user, {
		fields: [log.targetId],
		references: [user.id],
		relationName: "log_targetId_user_id",
	}),
	account: one(account, {
		fields: [log.accountId],
		references: [account.id],
	}),
	session: one(session, {
		fields: [log.sessionId],
		references: [session.id],
	}),
	invitation: one(invitation, {
		fields: [log.invitationId],
		references: [invitation.id],
	}),
}));

export const moduleOutboxEventRelations = relations(
	moduleOutboxEvent,
	({ one, many }) => ({
		module: one(module, {
			fields: [moduleOutboxEvent.storeId],
			references: [module.id],
		}),
		moduleEventDeliveries: many(moduleEventDelivery),
	}),
);

export const moduleRelations = relations(module, ({ many }) => ({
	moduleOutboxEvents: many(moduleOutboxEvent),
	moduleData: many(moduleData),
	moduleEventSequences: many(moduleEventSequence),
}));

export const moduleDataRelations = relations(moduleData, ({ one, many }) => ({
	module: one(module, {
		fields: [moduleData.moduleId],
		references: [module.id],
	}),
	moduleDatum: one(moduleData, {
		fields: [moduleData.parentId],
		references: [moduleData.id],
		relationName: "moduleData_parentId_moduleData_id",
	}),
	moduleData: many(moduleData, {
		relationName: "moduleData_parentId_moduleData_id",
	}),
}));

export const standingPermissionUseReservationRelations = relations(
	standingPermissionUseReservation,
	({ one }) => ({
		standingPermission: one(standingPermission, {
			fields: [standingPermissionUseReservation.standingPermissionId],
			references: [standingPermission.id],
		}),
		commandExecution: one(commandExecution, {
			fields: [standingPermissionUseReservation.commandExecutionId],
			references: [commandExecution.id],
		}),
	}),
);

export const standingPermissionRelations = relations(
	standingPermission,
	({ many }) => ({
		standingPermissionUseReservations: many(standingPermissionUseReservation),
	}),
);

export const webhookDeliveryRelations = relations(
	webhookDelivery,
	({ one }) => ({
		webhook: one(webhook, {
			fields: [webhookDelivery.webhookId],
			references: [webhook.id],
		}),
	}),
);

export const webhookRelations = relations(webhook, ({ many }) => ({
	webhookDeliveries: many(webhookDelivery),
}));

export const moduleEventConsumptionRelations = relations(
	moduleEventConsumption,
	({ one }) => ({
		moduleEventDelivery: one(moduleEventDelivery, {
			fields: [moduleEventConsumption.consumer],
			references: [moduleEventDelivery.eventId],
		}),
	}),
);

export const moduleEventDeliveryRelations = relations(
	moduleEventDelivery,
	({ one, many }) => ({
		moduleEventConsumptions: many(moduleEventConsumption),
		moduleOutboxEvent: one(moduleOutboxEvent, {
			fields: [moduleEventDelivery.eventId],
			references: [moduleOutboxEvent.id],
		}),
	}),
);

export const moduleEventSequenceRelations = relations(
	moduleEventSequence,
	({ one }) => ({
		module: one(module, {
			fields: [moduleEventSequence.storeId],
			references: [module.name],
		}),
	}),
);
