import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutomationsController } from "../service-impl";

describe("createAutomationsController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAutomationsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAutomationsController(mockData);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// ── Create ───────────────────────────────────────────────────────────

	describe("create", () => {
		it("creates an automation with required fields", async () => {
			const automation = await controller.create({
				name: "Low stock alert",
				triggerEvent: "inventory.low_stock",
				actions: [
					{
						type: "send_notification",
						config: { title: "Low Stock", message: "Reorder needed" },
					},
				],
			});
			expect(automation.id).toBeDefined();
			expect(automation.name).toBe("Low stock alert");
			expect(automation.triggerEvent).toBe("inventory.low_stock");
			expect(automation.status).toBe("draft");
			expect(automation.priority).toBe(0);
			expect(automation.runCount).toBe(0);
			expect(automation.actions).toHaveLength(1);
			expect(automation.createdAt).toBeInstanceOf(Date);
		});

		it("creates with optional fields", async () => {
			const automation = await controller.create({
				name: "Order notification",
				description: "Send notification when order is placed",
				triggerEvent: "order.placed",
				conditions: [{ field: "total", operator: "greater_than", value: 100 }],
				actions: [
					{
						type: "send_email",
						config: { to: "admin@store.com", subject: "New order" },
					},
				],
				priority: 10,
				status: "active",
			});
			expect(automation.description).toBe(
				"Send notification when order is placed",
			);
			expect(automation.conditions).toHaveLength(1);
			expect(automation.priority).toBe(10);
			expect(automation.status).toBe("active");
		});

		it("generates unique IDs", async () => {
			const a1 = await controller.create({
				name: "First",
				triggerEvent: "event.a",
				actions: [{ type: "log", config: {} }],
			});
			const a2 = await controller.create({
				name: "Second",
				triggerEvent: "event.b",
				actions: [{ type: "log", config: {} }],
			});
			expect(a1.id).not.toBe(a2.id);
		});
	});

	// ── Get by ID ────────────────────────────────────────────────────────

	describe("getById", () => {
		it("returns automation by ID", async () => {
			const created = await controller.create({
				name: "Test",
				triggerEvent: "test.event",
				actions: [{ type: "log", config: {} }],
			});
			const found = await controller.getById(created.id);
			expect(found?.name).toBe("Test");
			expect(found?.triggerEvent).toBe("test.event");
		});

		it("returns null for unknown ID", async () => {
			const found = await controller.getById("unknown");
			expect(found).toBeNull();
		});
	});

	// ── List ─────────────────────────────────────────────────────────────

	describe("list", () => {
		it("returns all automations", async () => {
			await controller.create({
				name: "A1",
				triggerEvent: "event.a",
				actions: [{ type: "log", config: {} }],
			});
			await controller.create({
				name: "A2",
				triggerEvent: "event.b",
				actions: [{ type: "log", config: {} }],
			});

			const result = await controller.list();
			expect(result.automations).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it("filters by status", async () => {
			await controller.create({
				name: "Active",
				triggerEvent: "event.a",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			await controller.create({
				name: "Draft",
				triggerEvent: "event.b",
				actions: [{ type: "log", config: {} }],
			});

			const result = await controller.list({ status: "active" });
			expect(result.automations).toHaveLength(1);
			expect(result.automations[0].name).toBe("Active");
		});

		it("filters by trigger event", async () => {
			await controller.create({
				name: "Order rule",
				triggerEvent: "order.placed",
				actions: [{ type: "log", config: {} }],
			});
			await controller.create({
				name: "Inventory rule",
				triggerEvent: "inventory.low_stock",
				actions: [{ type: "log", config: {} }],
			});

			const result = await controller.list({
				triggerEvent: "order.placed",
			});
			expect(result.automations).toHaveLength(1);
			expect(result.automations[0].name).toBe("Order rule");
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create({
					name: `Auto ${i}`,
					triggerEvent: "event.x",
					actions: [{ type: "log", config: {} }],
				});
			}

			const result = await controller.list({ take: 2 });
			expect(result.automations).toHaveLength(2);
		});
	});

	// ── Update ───────────────────────────────────────────────────────────

	describe("update", () => {
		it("updates automation fields", async () => {
			const created = await controller.create({
				name: "Original",
				triggerEvent: "event.a",
				actions: [{ type: "log", config: {} }],
			});

			const updated = await controller.update(created.id, {
				name: "Updated",
				priority: 5,
			});
			expect(updated.name).toBe("Updated");
			expect(updated.priority).toBe(5);
			expect(updated.triggerEvent).toBe("event.a");
		});

		it("throws for unknown ID", async () => {
			await expect(
				controller.update("unknown", { name: "Test" }),
			).rejects.toThrow("Automation unknown not found");
		});
	});

	// ── Delete ───────────────────────────────────────────────────────────

	describe("delete", () => {
		it("deletes automation and its executions", async () => {
			const created = await controller.create({
				name: "To delete",
				triggerEvent: "event.a",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			await controller.execute(created.id, {});

			await controller.delete(created.id);

			const found = await controller.getById(created.id);
			expect(found).toBeNull();

			const executions = await controller.listExecutions({
				automationId: created.id,
			});
			expect(executions.executions).toHaveLength(0);
		});
	});

	// ── Activate / Pause ─────────────────────────────────────────────────

	describe("activate", () => {
		it("sets status to active", async () => {
			const created = await controller.create({
				name: "Draft",
				triggerEvent: "event.a",
				actions: [{ type: "log", config: {} }],
			});
			expect(created.status).toBe("draft");

			const activated = await controller.activate(created.id);
			expect(activated.status).toBe("active");
		});

		it("throws for unknown ID", async () => {
			await expect(controller.activate("unknown")).rejects.toThrow(
				"Automation unknown not found",
			);
		});
	});

	describe("pause", () => {
		it("sets status to paused", async () => {
			const created = await controller.create({
				name: "Active",
				triggerEvent: "event.a",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});

			const paused = await controller.pause(created.id);
			expect(paused.status).toBe("paused");
		});
	});

	// ── Duplicate ────────────────────────────────────────────────────────

	describe("duplicate", () => {
		it("creates a copy with draft status and reset run count", async () => {
			const original = await controller.create({
				name: "Original",
				triggerEvent: "event.a",
				actions: [{ type: "log", config: {} }],
				status: "active",
				priority: 5,
			});
			await controller.execute(original.id, {});

			const copy = await controller.duplicate(original.id);
			expect(copy.id).not.toBe(original.id);
			expect(copy.name).toBe("Original (copy)");
			expect(copy.status).toBe("draft");
			expect(copy.runCount).toBe(0);
			expect(copy.triggerEvent).toBe("event.a");
			expect(copy.priority).toBe(5);
		});

		it("throws for unknown ID", async () => {
			await expect(controller.duplicate("unknown")).rejects.toThrow(
				"Automation unknown not found",
			);
		});
	});

	// ── Execute ──────────────────────────────────────────────────────────

	describe("execute", () => {
		it("executes automation with log action", async () => {
			const automation = await controller.create({
				name: "Logger",
				triggerEvent: "test.event",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});

			const execution = await controller.execute(automation.id, {
				data: "test",
			});
			expect(execution.status).toBe("completed");
			expect(execution.results).toHaveLength(1);
			expect(execution.results[0].status).toBe("success");
			expect(execution.automationId).toBe(automation.id);
		});

		it("skips execution when conditions are not met", async () => {
			const automation = await controller.create({
				name: "Conditional",
				triggerEvent: "order.placed",
				conditions: [{ field: "total", operator: "greater_than", value: 100 }],
				actions: [{ type: "log", config: {} }],
				status: "active",
			});

			const execution = await controller.execute(automation.id, {
				total: 50,
			});
			expect(execution.status).toBe("skipped");
			expect(execution.results).toHaveLength(0);
		});

		it("runs when conditions are met", async () => {
			const automation = await controller.create({
				name: "Conditional",
				triggerEvent: "order.placed",
				conditions: [{ field: "total", operator: "greater_than", value: 100 }],
				actions: [{ type: "log", config: {} }],
				status: "active",
			});

			const execution = await controller.execute(automation.id, {
				total: 200,
			});
			expect(execution.status).toBe("completed");
		});

		it("marks failed when action is misconfigured", async () => {
			const automation = await controller.create({
				name: "Bad email",
				triggerEvent: "test.event",
				actions: [{ type: "send_email", config: {} }],
				status: "active",
			});

			const execution = await controller.execute(automation.id, {});
			expect(execution.status).toBe("failed");
			expect(execution.error).toContain("send_email requires to and subject");
		});

		it("executes multiple actions in order", async () => {
			vi.stubGlobal(
				"fetch",
				vi
					.fn()
					.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
			);

			const automation = await controller.create({
				name: "Multi-action",
				triggerEvent: "test.event",
				actions: [
					{ type: "log", config: {} },
					{
						type: "webhook",
						config: { url: "https://hooks.example.com/test" },
					},
				],
				status: "active",
			});

			const execution = await controller.execute(automation.id, {});
			expect(execution.status).toBe("completed");
			expect(execution.results).toHaveLength(2);
			expect(execution.results[0].actionIndex).toBe(0);
			expect(execution.results[1].actionIndex).toBe(1);
		});

		it("increments runCount on automation", async () => {
			const automation = await controller.create({
				name: "Counter test",
				triggerEvent: "test.event",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});

			await controller.execute(automation.id, {});
			await controller.execute(automation.id, {});

			const updated = await controller.getById(automation.id);
			expect(updated?.runCount).toBe(2);
			expect(updated?.lastRunAt).toBeDefined();
		});
	});

	// ── Condition evaluation ─────────────────────────────────────────────

	describe("condition evaluation", () => {
		async function testCondition(
			operator: string,
			condValue: unknown,
			payloadValue: unknown,
			expected: "completed" | "skipped",
		) {
			const automation = await controller.create({
				name: `Test ${operator}`,
				triggerEvent: "test.event",
				conditions: [
					{
						field: "testField",
						operator: operator as Parameters<
							typeof controller.create
						>[0]["conditions"] extends Array<{ operator: infer O }> | undefined
							? O
							: never,
						...(condValue !== undefined
							? { value: condValue as string | number | boolean }
							: {}),
					},
				],
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			const execution = await controller.execute(automation.id, {
				testField: payloadValue,
			});
			expect(execution.status).toBe(expected);
		}

		it("equals - matches", async () => {
			await testCondition("equals", "active", "active", "completed");
		});

		it("equals - does not match", async () => {
			await testCondition("equals", "active", "inactive", "skipped");
		});

		it("not_equals - matches", async () => {
			await testCondition("not_equals", "active", "inactive", "completed");
		});

		it("contains - matches", async () => {
			await testCondition("contains", "world", "hello world", "completed");
		});

		it("contains - does not match", async () => {
			await testCondition("contains", "foo", "hello world", "skipped");
		});

		it("not_contains - matches", async () => {
			await testCondition("not_contains", "foo", "hello world", "completed");
		});

		it("greater_than - matches", async () => {
			await testCondition("greater_than", 50, 100, "completed");
		});

		it("greater_than - does not match", async () => {
			await testCondition("greater_than", 50, 30, "skipped");
		});

		it("less_than - matches", async () => {
			await testCondition("less_than", 100, 50, "completed");
		});

		it("exists - matches", async () => {
			await testCondition("exists", undefined, "value", "completed");
		});

		it("exists - does not match", async () => {
			const automation = await controller.create({
				name: "Test exists miss",
				triggerEvent: "test.event",
				conditions: [{ field: "missingField", operator: "exists" }],
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			const execution = await controller.execute(automation.id, {});
			expect(execution.status).toBe("skipped");
		});

		it("not_exists - matches when field missing", async () => {
			const automation = await controller.create({
				name: "Test not_exists",
				triggerEvent: "test.event",
				conditions: [{ field: "missingField", operator: "not_exists" }],
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			const execution = await controller.execute(automation.id, {});
			expect(execution.status).toBe("completed");
		});
	});

	// ── Evaluate event ───────────────────────────────────────────────────

	describe("evaluateEvent", () => {
		it("runs all active automations for an event", async () => {
			await controller.create({
				name: "Handler 1",
				triggerEvent: "order.placed",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			await controller.create({
				name: "Handler 2",
				triggerEvent: "order.placed",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			await controller.create({
				name: "Inactive handler",
				triggerEvent: "order.placed",
				actions: [{ type: "log", config: {} }],
				status: "draft",
			});

			const executions = await controller.evaluateEvent("order.placed", {
				orderId: "ord_1",
			});
			expect(executions).toHaveLength(2);
			expect(executions[0].status).toBe("completed");
			expect(executions[1].status).toBe("completed");
		});

		it("returns empty array when no automations match", async () => {
			const executions = await controller.evaluateEvent("unknown.event", {});
			expect(executions).toHaveLength(0);
		});
	});

	// ── Execution history ────────────────────────────────────────────────

	describe("getExecution", () => {
		it("returns execution by ID", async () => {
			const automation = await controller.create({
				name: "Test",
				triggerEvent: "test.event",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			const execution = await controller.execute(automation.id, {});

			const found = await controller.getExecution(execution.id);
			expect(found?.automationId).toBe(automation.id);
			expect(found?.status).toBe("completed");
		});

		it("returns null for unknown ID", async () => {
			const found = await controller.getExecution("unknown");
			expect(found).toBeNull();
		});
	});

	describe("listExecutions", () => {
		it("returns all executions", async () => {
			const automation = await controller.create({
				name: "Test",
				triggerEvent: "test.event",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			await controller.execute(automation.id, {});
			await controller.execute(automation.id, {});

			const result = await controller.listExecutions();
			expect(result.executions).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it("filters by automation ID", async () => {
			const a1 = await controller.create({
				name: "A1",
				triggerEvent: "event.a",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			const a2 = await controller.create({
				name: "A2",
				triggerEvent: "event.b",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			await controller.execute(a1.id, {});
			await controller.execute(a2.id, {});

			const result = await controller.listExecutions({
				automationId: a1.id,
			});
			expect(result.executions).toHaveLength(1);
			expect(result.executions[0].automationId).toBe(a1.id);
		});

		it("filters by status", async () => {
			const automation = await controller.create({
				name: "Test",
				triggerEvent: "test.event",
				conditions: [{ field: "pass", operator: "equals", value: true }],
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			await controller.execute(automation.id, { pass: true });
			await controller.execute(automation.id, { pass: false });

			const completed = await controller.listExecutions({
				status: "completed",
			});
			expect(completed.executions).toHaveLength(1);

			const skipped = await controller.listExecutions({
				status: "skipped",
			});
			expect(skipped.executions).toHaveLength(1);
		});

		it("supports pagination", async () => {
			const automation = await controller.create({
				name: "Test",
				triggerEvent: "test.event",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			for (let i = 0; i < 5; i++) {
				await controller.execute(automation.id, {});
			}

			const result = await controller.listExecutions({ take: 2 });
			expect(result.executions).toHaveLength(2);
		});
	});

	// ── Stats ────────────────────────────────────────────────────────────

	describe("getStats", () => {
		it("returns empty stats for clean state", async () => {
			const stats = await controller.getStats();
			expect(stats.totalAutomations).toBe(0);
			expect(stats.activeAutomations).toBe(0);
			expect(stats.totalExecutions).toBe(0);
			expect(stats.executionsByStatus).toEqual({});
			expect(stats.topAutomations).toHaveLength(0);
		});

		it("calculates correct stats", async () => {
			const a1 = await controller.create({
				name: "Active one",
				triggerEvent: "event.a",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			await controller.create({
				name: "Draft one",
				triggerEvent: "event.b",
				actions: [{ type: "log", config: {} }],
			});

			await controller.execute(a1.id, {});
			await controller.execute(a1.id, {});

			const stats = await controller.getStats();
			expect(stats.totalAutomations).toBe(2);
			expect(stats.activeAutomations).toBe(1);
			expect(stats.totalExecutions).toBe(2);
			expect(stats.executionsByStatus.completed).toBe(2);
			expect(stats.topAutomations).toHaveLength(2);
			expect(stats.topAutomations[0].name).toBe("Active one");
			expect(stats.topAutomations[0].runCount).toBe(2);
		});
	});

	// ── Purge executions ─────────────────────────────────────────────────

	describe("purgeExecutions", () => {
		it("deletes old executions", async () => {
			const automation = await controller.create({
				name: "Test",
				triggerEvent: "test.event",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});
			const oldExec = await controller.execute(automation.id, {});

			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 60);
			await mockData.upsert("automationExecution", oldExec.id, {
				...oldExec,
				startedAt: oldDate,
			} as Record<string, unknown>);

			await controller.execute(automation.id, {});

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			const deleted = await controller.purgeExecutions(cutoff);

			expect(deleted).toBe(1);

			const result = await controller.listExecutions();
			expect(result.total).toBe(1);
		});

		it("returns 0 when nothing to purge", async () => {
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			const deleted = await controller.purgeExecutions(cutoff);
			expect(deleted).toBe(0);
		});
	});

	// ── Action types ─────────────────────────────────────────────────────

	describe("action types", () => {
		// send_notification

		it("send_notification fails without notifications controller", async () => {
			const automation = await controller.create({
				name: "Notify",
				triggerEvent: "test.event",
				actions: [
					{
						type: "send_notification",
						config: {
							title: "Alert",
							message: "Something happened",
							customerId: "cust_1",
						},
					},
				],
				status: "active",
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.results[0].status).toBe("failed");
			expect(exec.results[0].error).toContain("notifications module");
		});

		it("send_notification succeeds with notifications controller", async () => {
			const mockCreate = vi.fn().mockResolvedValue({
				ok: true,
				decision: { notificationId: "notif_1" },
			});
			const ctrlWithNotifications = createAutomationsController(
				mockData,
				{},
				{ invoke: mockCreate },
			);

			const automation = await ctrlWithNotifications.create({
				name: "Notify",
				triggerEvent: "test.event",
				actions: [
					{
						type: "send_notification",
						config: {
							title: "Alert",
							message: "Something happened",
							customerId: "cust_1",
						},
					},
				],
				status: "active",
			});
			const exec = await ctrlWithNotifications.execute(automation.id, {});
			expect(exec.results[0].status).toBe("success");
			expect(exec.results[0].output).toMatchObject({
				title: "Alert",
				customerId: "cust_1",
			});
			expect(mockCreate).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					customerId: "cust_1",
					title: "Alert",
					body: "Something happened",
				}),
			);
		});

		it("send_notification uses customerId from payload when not in config", async () => {
			const mockCreate = vi.fn().mockResolvedValue({
				ok: true,
				decision: { notificationId: "notif_1" },
			});
			const ctrlWithNotifications = createAutomationsController(
				mockData,
				{},
				{ invoke: mockCreate },
			);

			const automation = await ctrlWithNotifications.create({
				name: "Notify",
				triggerEvent: "test.event",
				actions: [
					{
						type: "send_notification",
						config: { title: "Alert", message: "Test" },
					},
				],
				status: "active",
			});
			const exec = await ctrlWithNotifications.execute(automation.id, {
				customerId: "cust_from_payload",
			});
			expect(exec.results[0].status).toBe("success");
			expect(mockCreate).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ customerId: "cust_from_payload" }),
			);
		});

		it("send_notification fails without required config", async () => {
			const automation = await controller.create({
				name: "Bad notify",
				triggerEvent: "test.event",
				actions: [{ type: "send_notification", config: {} }],
				status: "active",
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.results[0].status).toBe("failed");
			expect(exec.results[0].error).toContain(
				"send_notification requires title and body/message",
			);
		});

		// send_email

		it("send_email fails without required config", async () => {
			const automation = await controller.create({
				name: "Bad email",
				triggerEvent: "test.event",
				actions: [{ type: "send_email", config: {} }],
				status: "active",
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.results[0].status).toBe("failed");
			expect(exec.results[0].error).toContain(
				"send_email requires to and subject",
			);
		});

		it("send_email fails when resendApiKey not configured", async () => {
			const automation = await controller.create({
				name: "Email no key",
				triggerEvent: "test.event",
				actions: [
					{
						type: "send_email",
						config: { to: "user@example.com", subject: "Hello" },
					},
				],
				status: "active",
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.results[0].status).toBe("failed");
			expect(exec.results[0].error).toContain("resendApiKey");
		});

		it("send_email makes real Resend API call when configured", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ id: "email_abc123" }),
			});
			vi.stubGlobal("fetch", mockFetch);

			const ctrlWithEmail = createAutomationsController(mockData, {
				resendApiKey: "re_test_key",
				resendFrom: "noreply@store.com",
			});

			const automation = await ctrlWithEmail.create({
				name: "Welcome email",
				triggerEvent: "order.placed",
				actions: [
					{
						type: "send_email",
						config: {
							to: "customer@example.com",
							subject: "Your order is confirmed",
							body: "Thanks for your order!",
						},
					},
				],
				status: "active",
			});

			const exec = await ctrlWithEmail.execute(automation.id, {});
			expect(exec.results[0].status).toBe("success");
			expect(exec.results[0].output).toMatchObject({
				to: "customer@example.com",
				subject: "Your order is confirmed",
				messageId: "email_abc123",
			});
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.resend.com/emails",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						Authorization: "Bearer re_test_key",
					}),
				}),
			);
		});

		it("send_email marks failed when Resend returns error", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: false,
					status: 422,
					json: async () => ({ message: "Invalid email address" }),
				}),
			);

			const ctrlWithEmail = createAutomationsController(mockData, {
				resendApiKey: "re_test_key",
			});

			const automation = await ctrlWithEmail.create({
				name: "Bad email",
				triggerEvent: "test.event",
				actions: [
					{
						type: "send_email",
						config: { to: "bad", subject: "Test" },
					},
				],
				status: "active",
			});

			const exec = await ctrlWithEmail.execute(automation.id, {});
			expect(exec.results[0].status).toBe("failed");
			expect(exec.results[0].error).toContain("Invalid email address");
		});

		// webhook

		it("webhook makes real HTTP POST with payload", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({}),
			});
			vi.stubGlobal("fetch", mockFetch);

			const automation = await controller.create({
				name: "Hook",
				triggerEvent: "test.event",
				actions: [
					{
						type: "webhook",
						config: { url: "https://hooks.example.com/test" },
					},
				],
				status: "active",
			});
			const exec = await controller.execute(automation.id, {
				orderId: "ord_1",
			});
			expect(exec.results[0].status).toBe("success");
			expect(exec.results[0].output).toMatchObject({
				url: "https://hooks.example.com/test",
				statusCode: 200,
			});
			expect(mockFetch).toHaveBeenCalledWith(
				"https://hooks.example.com/test",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"Content-Type": "application/json",
					}),
					body: JSON.stringify({ orderId: "ord_1" }),
				}),
			);
		});

		it("webhook fails when server returns non-OK status", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: false,
					status: 500,
					json: async () => ({}),
				}),
			);

			const automation = await controller.create({
				name: "Failing hook",
				triggerEvent: "test.event",
				actions: [
					{
						type: "webhook",
						config: { url: "https://hooks.example.com/fail" },
					},
				],
				status: "active",
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.results[0].status).toBe("failed");
			expect(exec.results[0].error).toContain("HTTP 500");
		});

		it("webhook fails when network error occurs", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockRejectedValue(new Error("Network unreachable")),
			);

			const automation = await controller.create({
				name: "Network fail hook",
				triggerEvent: "test.event",
				actions: [
					{
						type: "webhook",
						config: { url: "https://hooks.example.com/timeout" },
					},
				],
				status: "active",
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.results[0].status).toBe("failed");
			expect(exec.results[0].error).toContain("Network unreachable");
		});

		it("webhook sends X-Webhook-Secret header when secret configured", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({}),
			});
			vi.stubGlobal("fetch", mockFetch);

			const automation = await controller.create({
				name: "Secure hook",
				triggerEvent: "test.event",
				actions: [
					{
						type: "webhook",
						config: {
							url: "https://hooks.example.com/secure",
							secret: "mysecret",
						},
					},
				],
				status: "active",
			});
			await controller.execute(automation.id, {});
			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Webhook-Secret": "mysecret",
					}),
				}),
			);
		});

		it("webhook fails without url", async () => {
			const automation = await controller.create({
				name: "Bad hook",
				triggerEvent: "test.event",
				actions: [{ type: "webhook", config: {} }],
				status: "active",
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.results[0].status).toBe("failed");
		});

		it("update_field updates a field on an existing entity", async () => {
			// Seed an order record into the mock data store
			const orderId = "order-to-update";
			await mockData.upsert("order", orderId, {
				id: orderId,
				status: "pending",
				createdAt: new Date(),
			});

			const automation = await controller.create({
				name: "Update Order Status",
				triggerEvent: "test.event",
				actions: [
					{
						type: "update_field",
						config: {
							entity: "order",
							entityId: orderId,
							field: "status",
							value: "processing",
						},
					},
				],
				status: "active",
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.results[0].status).toBe("success");
			expect(exec.results[0].output).toMatchObject({
				entity: "order",
				entityId: orderId,
				field: "status",
				value: "processing",
			});

			// Verify the field was actually updated in the data store
			const updated = await mockData.get("order", orderId);
			expect((updated as Record<string, unknown>).status).toBe("processing");
		});

		it("update_field resolves entityId from payload when not in config", async () => {
			const orderId = "order-from-payload";
			await mockData.upsert("order", orderId, {
				id: orderId,
				status: "pending",
				createdAt: new Date(),
			});

			const automation = await controller.create({
				name: "Update via Payload",
				triggerEvent: "order.created",
				actions: [
					{
						type: "update_field",
						config: { entity: "order", field: "status", value: "confirmed" },
					},
				],
				status: "active",
			});
			const exec = await controller.execute(automation.id, { orderId });
			expect(exec.results[0].status).toBe("success");
			const updated = await mockData.get("order", orderId);
			expect((updated as Record<string, unknown>).status).toBe("confirmed");
		});

		it("update_field fails when entityId is not resolvable", async () => {
			const automation = await controller.create({
				name: "Update Missing",
				triggerEvent: "test.event",
				actions: [
					{
						type: "update_field",
						config: { entity: "order", field: "status", value: "processing" },
					},
				],
				status: "active",
			});
			// No entityId in config or payload
			const exec = await controller.execute(automation.id, {});
			expect(exec.results[0].status).toBe("failed");
			expect(exec.results[0].error).toContain("no entityId");
		});

		it("create_record succeeds with entity", async () => {
			const automation = await controller.create({
				name: "Create",
				triggerEvent: "test.event",
				actions: [
					{
						type: "create_record",
						config: { entity: "notification" },
					},
				],
				status: "active",
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.results[0].status).toBe("success");
		});
	});
});
