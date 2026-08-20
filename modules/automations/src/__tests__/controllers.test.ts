import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutomationsController } from "../service-impl";

describe("automations controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAutomationsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAutomationsController(mockData);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function logAction() {
		return { type: "log" as const, config: {} };
	}

	async function createActive(
		overrides: Partial<Parameters<typeof controller.create>[0]> = {},
	) {
		return controller.create({
			name: "Test Automation",
			triggerEvent: "order.placed",
			actions: [logAction()],
			status: "active",
			...overrides,
		});
	}

	// ── CRUD with defaults and partial updates ──────────────────────────

	describe("CRUD defaults and partial updates", () => {
		it("applies all defaults when only required fields are provided", async () => {
			const a = await controller.create({
				name: "Minimal",
				triggerEvent: "event.x",
				actions: [logAction()],
			});
			expect(a.status).toBe("draft");
			expect(a.priority).toBe(0);
			expect(a.runCount).toBe(0);
			expect(a.conditions).toEqual([]);
			expect(a.lastRunAt).toBeUndefined();
		});

		it("partial update preserves untouched fields", async () => {
			const original = await createActive({
				name: "Original",
				description: "Original desc",
				priority: 7,
			});

			const updated = await controller.update(original.id, {
				name: "Renamed",
			});

			expect(updated.name).toBe("Renamed");
			expect(updated.description).toBe("Original desc");
			expect(updated.priority).toBe(7);
			expect(updated.triggerEvent).toBe("order.placed");
			expect(updated.status).toBe("active");
		});

		it("update replaces conditions array entirely", async () => {
			const a = await createActive({
				conditions: [
					{ field: "total", operator: "greater_than", value: 100 },
					{ field: "status", operator: "equals", value: "new" },
				],
			});

			const updated = await controller.update(a.id, {
				conditions: [{ field: "vip", operator: "equals", value: true }],
			});

			expect(updated.conditions).toHaveLength(1);
			expect(updated.conditions[0].field).toBe("vip");
		});

		it("update replaces actions array entirely", async () => {
			const a = await createActive({
				actions: [logAction(), logAction()],
			});

			const updated = await controller.update(a.id, {
				actions: [
					{
						type: "webhook",
						config: { url: "https://example.com/hook" },
					},
				],
			});

			expect(updated.actions).toHaveLength(1);
			expect(updated.actions[0].type).toBe("webhook");
		});

		it("update sets updatedAt to a later time", async () => {
			const a = await createActive();
			const originalUpdatedAt = a.updatedAt;

			// Small delay to ensure different timestamp
			await new Promise((resolve) => setTimeout(resolve, 5));

			const updated = await controller.update(a.id, { name: "Later" });
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});
	});

	// ── Condition operators — edge cases ────────────────────────────────

	describe("condition operators — edge cases", () => {
		async function execWithCondition(
			operator: string,
			condValue: unknown,
			payload: Record<string, unknown>,
		) {
			const a = await createActive({
				conditions: [
					{
						field: "f",
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
			});
			return controller.execute(a.id, payload);
		}

		it("equals with numeric comparison", async () => {
			const exec = await execWithCondition("equals", 42, { f: 42 });
			expect(exec.status).toBe("completed");
		});

		it("equals with boolean comparison", async () => {
			const exec = await execWithCondition("equals", true, { f: true });
			expect(exec.status).toBe("completed");
		});

		it("equals fails on type mismatch (string vs number)", async () => {
			const exec = await execWithCondition("equals", "42", { f: 42 });
			expect(exec.status).toBe("skipped");
		});

		it("not_equals skips when values are equal", async () => {
			const exec = await execWithCondition("not_equals", "same", {
				f: "same",
			});
			expect(exec.status).toBe("skipped");
		});

		it("contains skips on non-string payload value", async () => {
			const exec = await execWithCondition("contains", "test", { f: 123 });
			expect(exec.status).toBe("skipped");
		});

		it("not_contains skips on non-string payload value", async () => {
			const exec = await execWithCondition("not_contains", "test", {
				f: 123,
			});
			expect(exec.status).toBe("skipped");
		});

		it("greater_than skips on non-numeric payload value", async () => {
			const exec = await execWithCondition("greater_than", 10, {
				f: "not-a-number",
			});
			expect(exec.status).toBe("skipped");
		});

		it("greater_than skips when values are equal", async () => {
			const exec = await execWithCondition("greater_than", 50, { f: 50 });
			expect(exec.status).toBe("skipped");
		});

		it("less_than skips when values are equal", async () => {
			const exec = await execWithCondition("less_than", 50, { f: 50 });
			expect(exec.status).toBe("skipped");
		});

		it("less_than skips on non-numeric payload value", async () => {
			const exec = await execWithCondition("less_than", 10, {
				f: "not-a-number",
			});
			expect(exec.status).toBe("skipped");
		});

		it("exists matches when value is an empty string", async () => {
			const exec = await execWithCondition("exists", undefined, { f: "" });
			expect(exec.status).toBe("completed");
		});

		it("exists matches when value is 0", async () => {
			const exec = await execWithCondition("exists", undefined, { f: 0 });
			expect(exec.status).toBe("completed");
		});

		it("exists matches when value is false", async () => {
			const exec = await execWithCondition("exists", undefined, { f: false });
			expect(exec.status).toBe("completed");
		});

		it("exists skips when value is null", async () => {
			const exec = await execWithCondition("exists", undefined, { f: null });
			expect(exec.status).toBe("skipped");
		});

		it("not_exists matches when value is null", async () => {
			const exec = await execWithCondition("not_exists", undefined, {
				f: null,
			});
			expect(exec.status).toBe("completed");
		});

		it("not_exists skips when value is present", async () => {
			const exec = await execWithCondition("not_exists", undefined, {
				f: "present",
			});
			expect(exec.status).toBe("skipped");
		});
	});

	// ── AND logic for multiple conditions ───────────────────────────────

	describe("AND logic for multiple conditions", () => {
		it("passes when all conditions match", async () => {
			const a = await createActive({
				conditions: [
					{ field: "total", operator: "greater_than", value: 50 },
					{ field: "status", operator: "equals", value: "new" },
					{ field: "email", operator: "contains", value: "@" },
				],
			});

			const exec = await controller.execute(a.id, {
				total: 100,
				status: "new",
				email: "user@example.com",
			});
			expect(exec.status).toBe("completed");
		});

		it("fails when one of multiple conditions does not match", async () => {
			const a = await createActive({
				conditions: [
					{ field: "total", operator: "greater_than", value: 50 },
					{ field: "status", operator: "equals", value: "new" },
					{ field: "vip", operator: "equals", value: true },
				],
			});

			const exec = await controller.execute(a.id, {
				total: 100,
				status: "new",
				vip: false,
			});
			expect(exec.status).toBe("skipped");
		});

		it("fails when first condition fails despite others matching", async () => {
			const a = await createActive({
				conditions: [
					{ field: "total", operator: "greater_than", value: 500 },
					{ field: "status", operator: "equals", value: "new" },
				],
			});

			const exec = await controller.execute(a.id, {
				total: 100,
				status: "new",
			});
			expect(exec.status).toBe("skipped");
		});
	});

	// ── Empty conditions = always match ─────────────────────────────────

	describe("empty conditions always match", () => {
		it("executes with empty conditions and empty payload", async () => {
			const a = await createActive({ conditions: [] });
			const exec = await controller.execute(a.id, {});
			expect(exec.status).toBe("completed");
		});

		it("executes with no conditions provided (default)", async () => {
			const a = await controller.create({
				name: "No conditions",
				triggerEvent: "event.x",
				actions: [logAction()],
				status: "active",
			});
			const exec = await controller.execute(a.id, { anything: "goes" });
			expect(exec.status).toBe("completed");
		});
	});

	// ── Action validation — missing required config fields ──────────────

	describe("action validation — missing config fields", () => {
		async function execAction(type: string, config: Record<string, unknown>) {
			const a = await createActive({
				actions: [{ type: type as "log", config }],
			});
			return controller.execute(a.id, {});
		}

		it("send_notification fails without title", async () => {
			const exec = await execAction("send_notification", {
				message: "Hello",
			});
			expect(exec.status).toBe("failed");
			expect(exec.error).toContain(
				"send_notification requires title and body/message",
			);
		});

		it("send_notification fails without message", async () => {
			const exec = await execAction("send_notification", {
				title: "Alert",
			});
			expect(exec.status).toBe("failed");
			expect(exec.error).toContain(
				"send_notification requires title and body/message",
			);
		});

		it("send_email fails without to", async () => {
			const exec = await execAction("send_email", {
				subject: "Hello",
			});
			expect(exec.status).toBe("failed");
			expect(exec.error).toContain("send_email requires to and subject");
		});

		it("send_email fails without subject", async () => {
			const exec = await execAction("send_email", {
				to: "user@example.com",
			});
			expect(exec.status).toBe("failed");
			expect(exec.error).toContain("send_email requires to and subject");
		});

		it("webhook fails without url", async () => {
			const exec = await execAction("webhook", {});
			expect(exec.status).toBe("failed");
			expect(exec.error).toContain("webhook requires url");
		});

		it("update_field fails without entity", async () => {
			const exec = await execAction("update_field", {
				field: "status",
				value: "done",
			});
			expect(exec.status).toBe("failed");
			expect(exec.error).toContain("update_field requires entity and field");
		});

		it("update_field fails without field", async () => {
			const exec = await execAction("update_field", { entity: "order" });
			expect(exec.status).toBe("failed");
			expect(exec.error).toContain("update_field requires entity and field");
		});

		it("create_record fails without entity", async () => {
			const exec = await execAction("create_record", {});
			expect(exec.status).toBe("failed");
			expect(exec.error).toContain("create_record requires entity");
		});

		it("unknown action type fails", async () => {
			const exec = await execAction("nonexistent_action", {});
			expect(exec.status).toBe("failed");
			expect(exec.error).toContain("Unknown action type: nonexistent_action");
		});
	});

	// ── Execution status: completed vs failed vs skipped ────────────────

	describe("execution status outcomes", () => {
		it("completed when all actions succeed", async () => {
			const a = await createActive({
				actions: [logAction(), logAction()],
			});
			const exec = await controller.execute(a.id, {});
			expect(exec.status).toBe("completed");
			expect(exec.error).toBeUndefined();
		});

		it("failed when any action fails in a multi-action automation", async () => {
			vi.stubGlobal(
				"fetch",
				vi
					.fn()
					.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
			);
			const a = await createActive({
				actions: [
					logAction(),
					{ type: "send_email", config: {} }, // missing required fields — fails at validation
					{
						type: "webhook",
						config: { url: "https://example.com" },
					},
				],
			});
			const exec = await controller.execute(a.id, {});
			expect(exec.status).toBe("failed");
			expect(exec.results).toHaveLength(3);
			expect(exec.results[0].status).toBe("success");
			expect(exec.results[1].status).toBe("failed");
			expect(exec.results[2].status).toBe("success");
		});

		it("skipped records no action results", async () => {
			const a = await createActive({
				conditions: [{ field: "required", operator: "exists" }],
			});
			const exec = await controller.execute(a.id, {});
			expect(exec.status).toBe("skipped");
			expect(exec.results).toHaveLength(0);
		});

		it("failed error message concatenates all failed action errors", async () => {
			const a = await createActive({
				actions: [
					{ type: "send_email", config: {} },
					{ type: "webhook", config: {} },
				],
			});
			const exec = await controller.execute(a.id, {});
			expect(exec.status).toBe("failed");
			expect(exec.error).toContain("send_email requires to and subject");
			expect(exec.error).toContain("webhook requires url");
		});
	});

	// ── runCount and lastRunAt tracking ──────────────────────────────────

	describe("runCount and lastRunAt tracking", () => {
		it("does not increment runCount on skipped execution", async () => {
			const a = await createActive({
				conditions: [{ field: "gate", operator: "equals", value: "open" }],
			});
			await controller.execute(a.id, { gate: "closed" });

			const after = await controller.getById(a.id);
			expect(after?.runCount).toBe(0);
			expect(after?.lastRunAt).toBeUndefined();
		});

		it("increments runCount on failed execution", async () => {
			const a = await createActive({
				actions: [{ type: "send_email", config: {} }],
			});
			await controller.execute(a.id, {});

			const after = await controller.getById(a.id);
			expect(after?.runCount).toBe(1);
			expect(after?.lastRunAt).toBeDefined();
		});

		it("increments runCount correctly over many executions", async () => {
			const a = await createActive();
			for (let i = 0; i < 10; i++) {
				await controller.execute(a.id, {});
			}

			const after = await controller.getById(a.id);
			expect(after?.runCount).toBe(10);
		});
	});

	// ── evaluateEvent only triggers active automations ──────────────────

	describe("evaluateEvent selectivity", () => {
		it("ignores draft automations", async () => {
			await controller.create({
				name: "Draft",
				triggerEvent: "order.placed",
				actions: [logAction()],
				status: "draft",
			});

			const execs = await controller.evaluateEvent("order.placed", {});
			expect(execs).toHaveLength(0);
		});

		it("ignores paused automations", async () => {
			const a = await createActive({ triggerEvent: "order.placed" });
			await controller.pause(a.id);

			const execs = await controller.evaluateEvent("order.placed", {});
			expect(execs).toHaveLength(0);
		});

		it("ignores automations for different events", async () => {
			await createActive({ triggerEvent: "inventory.low_stock" });

			const execs = await controller.evaluateEvent("order.placed", {});
			expect(execs).toHaveLength(0);
		});

		it("executes multiple active automations for the same event", async () => {
			await createActive({ name: "Handler A", triggerEvent: "order.placed" });
			await createActive({ name: "Handler B", triggerEvent: "order.placed" });
			await createActive({ name: "Handler C", triggerEvent: "order.placed" });

			const execs = await controller.evaluateEvent("order.placed", {});
			expect(execs).toHaveLength(3);
		});

		it("mixes completed and skipped across multiple automations", async () => {
			await createActive({
				name: "Always runs",
				triggerEvent: "order.placed",
				conditions: [],
			});
			await createActive({
				name: "Conditional",
				triggerEvent: "order.placed",
				conditions: [{ field: "total", operator: "greater_than", value: 1000 }],
			});

			const execs = await controller.evaluateEvent("order.placed", {
				total: 50,
			});
			expect(execs).toHaveLength(2);

			const statuses = execs.map((e) => e.status);
			expect(statuses).toContain("completed");
			expect(statuses).toContain("skipped");
		});
	});

	// ── Duplicate copies everything except id/status/runCount ───────────

	describe("duplicate edge cases", () => {
		it("copies description, conditions, and actions from original", async () => {
			const original = await createActive({
				name: "Complex Rule",
				description: "Detailed description",
				conditions: [
					{ field: "total", operator: "greater_than", value: 100 },
					{ field: "vip", operator: "equals", value: true },
				],
				actions: [
					logAction(),
					{
						type: "send_email",
						config: { to: "admin@store.com", subject: "VIP Order" },
					},
				],
				priority: 15,
			});
			await controller.execute(original.id, { total: 200, vip: true });

			const copy = await controller.duplicate(original.id);

			expect(copy.id).not.toBe(original.id);
			expect(copy.name).toBe("Complex Rule (copy)");
			expect(copy.description).toBe("Detailed description");
			expect(copy.status).toBe("draft");
			expect(copy.runCount).toBe(0);
			expect(copy.lastRunAt).toBeUndefined();
			expect(copy.priority).toBe(15);
			expect(copy.triggerEvent).toBe("order.placed");
			expect(copy.conditions).toHaveLength(2);
			expect(copy.actions).toHaveLength(2);
		});

		it("duplicate gets its own new createdAt timestamp", async () => {
			const original = await createActive({ name: "Original" });
			await new Promise((resolve) => setTimeout(resolve, 5));
			const copy = await controller.duplicate(original.id);

			expect(copy.createdAt.getTime()).toBeGreaterThanOrEqual(
				original.createdAt.getTime(),
			);
		});

		it("duplicate is independently updatable", async () => {
			const original = await createActive({ name: "Source" });
			const copy = await controller.duplicate(original.id);

			await controller.update(copy.id, { name: "Modified Copy" });

			const originalCheck = await controller.getById(original.id);
			const copyCheck = await controller.getById(copy.id);
			expect(originalCheck?.name).toBe("Source");
			expect(copyCheck?.name).toBe("Modified Copy");
		});
	});

	// ── Delete cascades to executions ───────────────────────────────────

	describe("delete cascade", () => {
		it("removes all executions when automation is deleted", async () => {
			const a = await createActive();
			const exec1 = await controller.execute(a.id, {});
			const exec2 = await controller.execute(a.id, {});

			await controller.delete(a.id);

			const e1 = await controller.getExecution(exec1.id);
			const e2 = await controller.getExecution(exec2.id);
			expect(e1).toBeNull();
			expect(e2).toBeNull();
		});

		it("does not affect executions of other automations", async () => {
			const a1 = await createActive({ name: "A1" });
			const a2 = await createActive({ name: "A2" });

			await controller.execute(a1.id, {});
			const keepExec = await controller.execute(a2.id, {});

			await controller.delete(a1.id);

			const found = await controller.getExecution(keepExec.id);
			expect(found).not.toBeNull();
			expect(found?.automationId).toBe(a2.id);
		});
	});

	// ── purgeExecutions date filtering ──────────────────────────────────

	describe("purgeExecutions date filtering", () => {
		it("only deletes executions older than the cutoff date", async () => {
			const a = await createActive();

			const old1 = await controller.execute(a.id, {});
			const old2 = await controller.execute(a.id, {});

			// Backdate both old executions
			const sixtyDaysAgo = new Date();
			sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
			const fortyDaysAgo = new Date();
			fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

			await mockData.upsert("automationExecution", old1.id, {
				...old1,
				startedAt: sixtyDaysAgo,
			} as Record<string, unknown>);
			await mockData.upsert("automationExecution", old2.id, {
				...old2,
				startedAt: fortyDaysAgo,
			} as Record<string, unknown>);

			// Create a recent one
			await controller.execute(a.id, {});

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			const deleted = await controller.purgeExecutions(cutoff);

			expect(deleted).toBe(2);

			const remaining = await controller.listExecutions();
			expect(remaining.total).toBe(1);
		});

		it("does not delete anything when all executions are recent", async () => {
			const a = await createActive();
			await controller.execute(a.id, {});
			await controller.execute(a.id, {});

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			const deleted = await controller.purgeExecutions(cutoff);

			expect(deleted).toBe(0);

			const remaining = await controller.listExecutions();
			expect(remaining.total).toBe(2);
		});
	});

	// ── Stats accuracy ──────────────────────────────────────────────────

	describe("stats accuracy", () => {
		it("counts active vs total automations correctly", async () => {
			await createActive({ name: "Active 1" });
			await createActive({ name: "Active 2" });
			await controller.create({
				name: "Draft 1",
				triggerEvent: "event.x",
				actions: [logAction()],
			});
			const toPause = await createActive({ name: "Will Pause" });
			await controller.pause(toPause.id);

			const stats = await controller.getStats();
			expect(stats.totalAutomations).toBe(4);
			expect(stats.activeAutomations).toBe(2);
		});

		it("breaks down executions by status correctly", async () => {
			const passing = await createActive({ name: "Passes" });
			const failing = await createActive({
				name: "Fails",
				actions: [{ type: "send_email", config: {} }],
			});
			const skipping = await createActive({
				name: "Skips",
				conditions: [{ field: "nope", operator: "exists" }],
			});

			await controller.execute(passing.id, {});
			await controller.execute(passing.id, {});
			await controller.execute(failing.id, {});
			await controller.execute(skipping.id, {});

			const stats = await controller.getStats();
			expect(stats.totalExecutions).toBe(4);
			expect(stats.executionsByStatus.completed).toBe(2);
			expect(stats.executionsByStatus.failed).toBe(1);
			expect(stats.executionsByStatus.skipped).toBe(1);
		});

		it("topAutomations ranks by runCount descending", async () => {
			const low = await createActive({ name: "Low Runner" });
			const high = await createActive({ name: "High Runner" });
			const mid = await createActive({ name: "Mid Runner" });

			await controller.execute(low.id, {});
			for (let i = 0; i < 5; i++) {
				await controller.execute(high.id, {});
			}
			for (let i = 0; i < 3; i++) {
				await controller.execute(mid.id, {});
			}

			const stats = await controller.getStats();
			expect(stats.topAutomations[0].name).toBe("High Runner");
			expect(stats.topAutomations[0].runCount).toBe(5);
			expect(stats.topAutomations[1].name).toBe("Mid Runner");
			expect(stats.topAutomations[1].runCount).toBe(3);
			expect(stats.topAutomations[2].name).toBe("Low Runner");
			expect(stats.topAutomations[2].runCount).toBe(1);
		});

		it("topAutomations caps at 10 entries", async () => {
			for (let i = 0; i < 15; i++) {
				const a = await createActive({ name: `Auto ${i}` });
				await controller.execute(a.id, {});
			}

			const stats = await controller.getStats();
			expect(stats.topAutomations).toHaveLength(10);
		});
	});

	// ── Execution records correctness ───────────────────────────────────

	describe("execution records correctness", () => {
		it("records triggerPayload in execution", async () => {
			const a = await createActive();
			const payload = { orderId: "ord_123", total: 99.99 };
			const exec = await controller.execute(a.id, payload);

			const found = await controller.getExecution(exec.id);
			expect(found?.triggerPayload).toEqual(payload);
		});

		it("records triggerEvent from automation in execution", async () => {
			const a = await createActive({ triggerEvent: "inventory.updated" });
			const exec = await controller.execute(a.id, {});

			expect(exec.triggerEvent).toBe("inventory.updated");
		});

		it("sets startedAt and completedAt on execution", async () => {
			const a = await createActive();
			const exec = await controller.execute(a.id, {});

			expect(exec.startedAt).toBeInstanceOf(Date);
			expect(exec.completedAt).toBeInstanceOf(Date);
		});

		it("execute throws for non-existent automation", async () => {
			await expect(controller.execute("nonexistent-id", {})).rejects.toThrow(
				"Automation nonexistent-id not found",
			);
		});
	});

	// ── Activate and pause throws ───────────────────────────────────────

	describe("activate and pause error handling", () => {
		it("activate throws for non-existent automation", async () => {
			await expect(controller.activate("missing-id")).rejects.toThrow(
				"Automation missing-id not found",
			);
		});

		it("pause throws for non-existent automation", async () => {
			await expect(controller.pause("missing-id")).rejects.toThrow(
				"Automation missing-id not found",
			);
		});

		it("can activate a paused automation", async () => {
			const a = await createActive();
			await controller.pause(a.id);
			const reactivated = await controller.activate(a.id);
			expect(reactivated.status).toBe("active");
		});

		it("can activate a draft automation", async () => {
			const a = await controller.create({
				name: "Draft",
				triggerEvent: "event.x",
				actions: [logAction()],
			});
			const activated = await controller.activate(a.id);
			expect(activated.status).toBe("active");
		});
	});
});
