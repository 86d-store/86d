import type { CapabilityInvoker } from "@86d-app/core/capabilities";
import { notificationCreateCapability } from "@86d-app/core/commerce-capabilities";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Automation,
	AutomationAction,
	AutomationActionResult,
	AutomationCondition,
	AutomationExecution,
	AutomationsController,
} from "./service";

export type ActionExecutorOptions = {
	resendApiKey?: string | undefined;
	resendFrom?: string | undefined;
};

function evaluateCondition(
	condition: AutomationCondition,
	payload: Record<string, unknown>,
): boolean {
	const value = payload[condition.field];

	switch (condition.operator) {
		case "equals":
			return value === condition.value;
		case "not_equals":
			return value !== condition.value;
		case "contains":
			return (
				typeof value === "string" &&
				typeof condition.value === "string" &&
				value.includes(condition.value)
			);
		case "not_contains":
			return (
				typeof value === "string" &&
				typeof condition.value === "string" &&
				!value.includes(condition.value)
			);
		case "greater_than":
			return (
				typeof value === "number" &&
				typeof condition.value === "number" &&
				value > condition.value
			);
		case "less_than":
			return (
				typeof value === "number" &&
				typeof condition.value === "number" &&
				value < condition.value
			);
		case "exists":
			return value !== undefined && value !== null;
		case "not_exists":
			return value === undefined || value === null;
		default:
			return false;
	}
}

function evaluateConditions(
	conditions: AutomationCondition[],
	payload: Record<string, unknown>,
): boolean {
	if (conditions.length === 0) return true;
	return conditions.every((c) => evaluateCondition(c, payload));
}

async function executeAction(
	action: AutomationAction,
	payload: Record<string, unknown>,
	options: ActionExecutorOptions,
	capabilities: CapabilityInvoker | undefined,
	data: ModuleDataService,
): Promise<AutomationActionResult & { actionIndex: number }> {
	switch (action.type) {
		case "send_notification": {
			const {
				title,
				message,
				body,
				customerId: configCustomerId,
			} = action.config as {
				title?: string;
				message?: string;
				body?: string;
				customerId?: string;
			};
			const notifBody = body ?? message;
			if (!title || !notifBody) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: "send_notification requires title and body/message",
				};
			}
			if (!capabilities) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error:
						"send_notification requires the notifications module to be installed",
				};
			}
			const customerId = (configCustomerId ?? payload.customerId) as
				| string
				| undefined;
			if (!customerId) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: "send_notification requires customerId in config or payload",
				};
			}
			try {
				const created = await capabilities.invoke(
					notificationCreateCapability,
					{
						customerId,
						title,
						body: notifBody,
						metadata: { automationPayload: payload },
					},
				);
				if (!created.ok) {
					return {
						actionIndex: 0,
						type: action.type,
						status: "failed",
						error: "Notification capability is unavailable",
					};
				}
				return {
					actionIndex: 0,
					type: action.type,
					status: "success",
					output: { title, body: notifBody, customerId },
				};
			} catch {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: "Failed to create notification",
				};
			}
		}
		case "send_email": {
			const {
				to,
				subject,
				body: textBody,
				html,
				from,
			} = action.config as {
				to?: string;
				subject?: string;
				body?: string;
				html?: string;
				from?: string;
			};
			if (!to || !subject) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: "send_email requires to and subject",
				};
			}
			if (!options.resendApiKey) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: "send_email requires resendApiKey option",
				};
			}
			const fromAddress =
				from ?? options.resendFrom ?? "automations@example.com";
			try {
				const res = await fetch("https://api.resend.com/emails", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${options.resendApiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						from: fromAddress,
						to,
						subject,
						...(html ? { html } : {}),
						...(textBody ? { text: textBody } : {}),
					}),
				});
				if (!res.ok) {
					const errBody = (await res
						.json()
						.catch(() => ({ message: `HTTP ${res.status}` }))) as {
						message?: string;
					};
					return {
						actionIndex: 0,
						type: action.type,
						status: "failed",
						error: `Resend error: ${errBody.message ?? `HTTP ${res.status}`}`,
					};
				}
				const data = (await res.json()) as { id: string };
				return {
					actionIndex: 0,
					type: action.type,
					status: "success",
					output: { to, subject, messageId: data.id },
				};
			} catch (e) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: e instanceof Error ? e.message : "Failed to send email",
				};
			}
		}
		case "webhook": {
			const {
				url,
				method = "POST",
				headers: customHeaders,
				secret,
			} = action.config as {
				url?: string;
				method?: string;
				headers?: Record<string, string>;
				secret?: string;
			};
			if (!url) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: "webhook requires url",
				};
			}
			try {
				const reqHeaders: Record<string, string> = {
					"Content-Type": "application/json",
					...customHeaders,
				};
				if (secret) {
					reqHeaders["X-Webhook-Secret"] = secret;
				}
				const res = await fetch(url, {
					method,
					headers: reqHeaders,
					...(method !== "GET" ? { body: JSON.stringify(payload) } : {}),
				});
				if (!res.ok) {
					return {
						actionIndex: 0,
						type: action.type,
						status: "failed",
						error: `Webhook returned HTTP ${res.status}`,
					};
				}
				return {
					actionIndex: 0,
					type: action.type,
					status: "success",
					output: { url, statusCode: res.status },
				};
			} catch (e) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: e instanceof Error ? e.message : "Webhook request failed",
				};
			}
		}
		case "update_field": {
			const {
				entity,
				entityId: configEntityId,
				field,
				value,
			} = action.config as {
				entity?: string;
				entityId?: string;
				field?: string;
				value?: unknown;
			};
			if (!entity || !field) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: "update_field requires entity and field",
				};
			}
			// Resolve entity ID from config or from event payload
			const entityId =
				configEntityId ??
				(typeof payload[`${entity}Id`] === "string"
					? (payload[`${entity}Id`] as string)
					: undefined);
			if (!entityId) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: `update_field: no entityId found in config or payload for entity "${entity}"`,
				};
			}
			try {
				const existing = await data.get(entity, entityId);
				if (!existing) {
					return {
						actionIndex: 0,
						type: action.type,
						status: "failed",
						error: `update_field: ${entity} "${entityId}" not found`,
					};
				}
				const updated = {
					...(existing as Record<string, unknown>),
					[field]: value,
					updatedAt: new Date(),
				};
				await data.upsert(entity, entityId, updated);
				return {
					actionIndex: 0,
					type: action.type,
					status: "success",
					output: { entity, entityId, field, value },
				};
			} catch (e) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: e instanceof Error ? e.message : "update_field failed",
				};
			}
		}
		case "create_record": {
			const { entity, record } = action.config as {
				entity?: string;
				record?: Record<string, unknown>;
			};
			if (!entity) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: "create_record requires entity",
				};
			}
			try {
				const id = crypto.randomUUID();
				const now = new Date();
				const newRecord = {
					id,
					...(record ?? {}),
					createdAt: now,
					updatedAt: now,
				};
				await data.upsert(entity, id, newRecord);
				return {
					actionIndex: 0,
					type: action.type,
					status: "success",
					output: { entity, id },
				};
			} catch (e) {
				return {
					actionIndex: 0,
					type: action.type,
					status: "failed",
					error: e instanceof Error ? e.message : "create_record failed",
				};
			}
		}
		case "log": {
			return {
				actionIndex: 0,
				type: action.type,
				status: "success",
				output: { logged: true },
			};
		}
		default:
			return {
				actionIndex: 0,
				type: action.type,
				status: "failed",
				error: `Unknown action type: ${action.type}`,
			};
	}
}

export function createAutomationsController(
	data: ModuleDataService,
	options: ActionExecutorOptions = {},
	capabilities?: CapabilityInvoker,
): AutomationsController {
	return {
		async create(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const automation: Automation = {
				id,
				name: params.name,
				description: params.description,
				status: params.status ?? "draft",
				triggerEvent: params.triggerEvent,
				conditions: params.conditions ?? [],
				actions: params.actions,
				priority: params.priority ?? 0,
				runCount: 0,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"automation",
				id,
				automation as Record<string, unknown>,
			);
			return automation;
		},

		async getById(id) {
			const raw = await data.get("automation", id);
			if (!raw) return null;
			return raw as unknown as Automation;
		},

		async list(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.triggerEvent) where.triggerEvent = params.triggerEvent;

			const all = await data.findMany("automation", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { priority: "desc" },
			});
			const automations = all as unknown as Automation[];
			return { automations, total: automations.length };
		},

		async update(id, params) {
			const existing = await data.get("automation", id);
			if (!existing) throw new Error(`Automation ${id} not found`);
			const current = existing as unknown as Automation;

			const updated: Automation = {
				...current,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.description !== undefined
					? { description: params.description }
					: {}),
				...(params.triggerEvent !== undefined
					? { triggerEvent: params.triggerEvent }
					: {}),
				...(params.conditions !== undefined
					? { conditions: params.conditions }
					: {}),
				...(params.actions !== undefined ? { actions: params.actions } : {}),
				...(params.priority !== undefined ? { priority: params.priority } : {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				updatedAt: new Date(),
			};

			await data.upsert("automation", id, updated as Record<string, unknown>);
			return updated;
		},

		async delete(id) {
			const executions = await data.findMany("automationExecution", {
				where: { automationId: id },
			});
			for (const exec of executions) {
				await data.delete("automationExecution", exec.id as string);
			}
			await data.delete("automation", id);
		},

		async activate(id) {
			const existing = await data.get("automation", id);
			if (!existing) throw new Error(`Automation ${id} not found`);
			const current = existing as unknown as Automation;

			const updated: Automation = {
				...current,
				status: "active",
				updatedAt: new Date(),
			};
			await data.upsert("automation", id, updated as Record<string, unknown>);
			return updated;
		},

		async pause(id) {
			const existing = await data.get("automation", id);
			if (!existing) throw new Error(`Automation ${id} not found`);
			const current = existing as unknown as Automation;

			const updated: Automation = {
				...current,
				status: "paused",
				updatedAt: new Date(),
			};
			await data.upsert("automation", id, updated as Record<string, unknown>);
			return updated;
		},

		async duplicate(id) {
			const existing = await data.get("automation", id);
			if (!existing) throw new Error(`Automation ${id} not found`);
			const current = existing as unknown as Automation;

			const newId = crypto.randomUUID();
			const now = new Date();
			const copy: Automation = {
				...current,
				id: newId,
				name: `${current.name} (copy)`,
				status: "draft",
				runCount: 0,
				lastRunAt: undefined,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("automation", newId, copy as Record<string, unknown>);
			return copy;
		},

		async execute(id, triggerPayload) {
			const existing = await data.get("automation", id);
			if (!existing) throw new Error(`Automation ${id} not found`);
			const automation = existing as unknown as Automation;

			const execId = crypto.randomUUID();
			const now = new Date();

			const conditionsMet = evaluateConditions(
				automation.conditions,
				triggerPayload,
			);

			if (!conditionsMet) {
				const skipped: AutomationExecution = {
					id: execId,
					automationId: id,
					triggerEvent: automation.triggerEvent,
					triggerPayload,
					status: "skipped",
					results: [],
					startedAt: now,
					completedAt: now,
				};
				await data.upsert(
					"automationExecution",
					execId,
					skipped as Record<string, unknown>,
				);
				return skipped;
			}

			const results: AutomationActionResult[] = [];
			let hasFailure = false;

			for (let i = 0; i < automation.actions.length; i++) {
				const action = automation.actions[i];
				const result = await executeAction(
					action,
					triggerPayload,
					options,
					capabilities,
					data,
				);
				result.actionIndex = i;
				results.push(result);
				if (result.status === "failed") {
					hasFailure = true;
				}
			}

			const execution: AutomationExecution = {
				id: execId,
				automationId: id,
				triggerEvent: automation.triggerEvent,
				triggerPayload,
				status: hasFailure ? "failed" : "completed",
				results,
				error: hasFailure
					? results
							.filter((r) => r.status === "failed")
							.map((r) => r.error)
							.join("; ")
					: undefined,
				startedAt: now,
				completedAt: new Date(),
			};

			await data.upsert(
				"automationExecution",
				execId,
				execution as Record<string, unknown>,
			);

			const updatedAutomation: Automation = {
				...automation,
				runCount: automation.runCount + 1,
				lastRunAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"automation",
				id,
				updatedAutomation as Record<string, unknown>,
			);

			return execution;
		},

		async evaluateEvent(eventType, payload) {
			const all = await data.findMany("automation", {
				where: { triggerEvent: eventType, status: "active" },
				orderBy: { priority: "desc" },
			});
			const automations = all as unknown as Automation[];

			const executions: AutomationExecution[] = [];
			for (const automation of automations) {
				const execution = await this.execute(automation.id, payload);
				executions.push(execution);
			}
			return executions;
		},

		async getExecution(id) {
			const raw = await data.get("automationExecution", id);
			if (!raw) return null;
			return raw as unknown as AutomationExecution;
		},

		async listExecutions(params) {
			const where: Record<string, unknown> = {};
			if (params?.automationId) where.automationId = params.automationId;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("automationExecution", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { startedAt: "desc" },
			});
			const executions = all as unknown as AutomationExecution[];
			return { executions, total: executions.length };
		},

		async getStats() {
			const allAutomations = await data.findMany("automation", {});
			const automations = allAutomations as unknown as Automation[];

			const allExecutions = await data.findMany("automationExecution", {});
			const executions = allExecutions as unknown as AutomationExecution[];

			const executionsByStatus: Record<string, number> = {};
			for (const exec of executions) {
				executionsByStatus[exec.status] =
					(executionsByStatus[exec.status] ?? 0) + 1;
			}

			const topAutomations = [...automations]
				.sort((a, b) => b.runCount - a.runCount)
				.slice(0, 10)
				.map((a) => ({ id: a.id, name: a.name, runCount: a.runCount }));

			return {
				totalAutomations: automations.length,
				activeAutomations: automations.filter((a) => a.status === "active")
					.length,
				totalExecutions: executions.length,
				executionsByStatus,
				topAutomations,
			};
		},

		async purgeExecutions(olderThan) {
			const all = await data.findMany("automationExecution", {
				orderBy: { startedAt: "asc" },
			});
			const executions = all as unknown as AutomationExecution[];

			let deleted = 0;
			for (const exec of executions) {
				if (new Date(exec.startedAt) < olderThan) {
					await data.delete("automationExecution", exec.id);
					deleted++;
				}
			}
			return deleted;
		},
	};
}
