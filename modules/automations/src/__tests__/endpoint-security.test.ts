import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutomationsController } from "../service-impl";

/**
 * Security regression tests for automations endpoints.
 *
 * Focuses on:
 * - Cascade deletion removes associated execution records
 * - Duplicate resets status and runCount correctly
 * - Condition evaluation uses AND logic (all conditions must pass)
 * - Empty conditions always pass (unconditional execution)
 * - execute() increments runCount and sets lastRunAt
 * - evaluateEvent() only triggers active automations
 * - Action validation: required fields enforced per action type
 * - purgeExecutions removes only executions older than the cutoff
 */

describe("automations endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAutomationsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAutomationsController(mockData);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// ── helpers ───────────────────────────────────────────────────────────

	async function makeAutomation(
		overrides: Partial<Parameters<typeof controller.create>[0]> = {},
	) {
		return controller.create({
			name: "Test Automation",
			triggerEvent: "order.placed",
			actions: [{ type: "log", config: {} }],
			...overrides,
		});
	}

	// ── cascade deletion ──────────────────────────────────────────────────

	describe("cascade deletion", () => {
		it("deleting an automation removes its execution records", async () => {
			const automation = await makeAutomation({ status: "active" });
			await controller.execute(automation.id, {});
			await controller.execute(automation.id, {});

			// Verify executions exist before deletion
			const before = await controller.listExecutions({
				automationId: automation.id,
			});
			expect(before.total).toBe(2);

			await controller.delete(automation.id);

			// Automation should be gone
			const found = await controller.getById(automation.id);
			expect(found).toBeNull();

			// Executions should be purged
			const after = await controller.listExecutions({
				automationId: automation.id,
			});
			expect(after.total).toBe(0);
		});

		it("deleting one automation does not affect other automations' executions", async () => {
			const a1 = await makeAutomation({ status: "active" });
			const a2 = await makeAutomation({
				name: "Second",
				status: "active",
			});

			await controller.execute(a1.id, {});
			await controller.execute(a2.id, {});

			await controller.delete(a1.id);

			const a2Executions = await controller.listExecutions({
				automationId: a2.id,
			});
			expect(a2Executions.total).toBe(1);
		});
	});

	// ── duplicate ─────────────────────────────────────────────────────────

	describe("duplicate", () => {
		it("creates a copy with draft status even when original is active", async () => {
			const original = await makeAutomation({ status: "active" });
			await controller.activate(original.id);

			const copy = await controller.duplicate(original.id);
			expect(copy.status).toBe("draft");
		});

		it("resets runCount to zero regardless of original run history", async () => {
			const original = await makeAutomation({ status: "active" });
			await controller.execute(original.id, {});
			await controller.execute(original.id, {});

			const originalAfter = await controller.getById(original.id);
			expect(originalAfter?.runCount).toBe(2);

			const copy = await controller.duplicate(original.id);
			expect(copy.runCount).toBe(0);
		});

		it("copy has no lastRunAt set", async () => {
			const original = await makeAutomation({ status: "active" });
			await controller.execute(original.id, {});

			const copy = await controller.duplicate(original.id);
			expect(copy.lastRunAt).toBeUndefined();
		});

		it("copy preserves the original's triggerEvent, actions, and priority", async () => {
			const original = await makeAutomation({
				triggerEvent: "customer.created",
				priority: 7,
				actions: [
					{
						type: "send_notification",
						config: { title: "Welcome", message: "Hello!" },
					},
				],
				status: "active",
			});

			const copy = await controller.duplicate(original.id);
			expect(copy.triggerEvent).toBe("customer.created");
			expect(copy.priority).toBe(7);
			expect(copy.actions).toHaveLength(1);
		});

		it("copy receives a new unique ID", async () => {
			const original = await makeAutomation();
			const copy = await controller.duplicate(original.id);
			expect(copy.id).not.toBe(original.id);
		});
	});

	// ── condition evaluation: AND logic ───────────────────────────────────

	describe("condition evaluation: AND logic", () => {
		it("all conditions must match for execution to proceed", async () => {
			const automation = await makeAutomation({
				status: "active",
				conditions: [
					{ field: "total", operator: "greater_than", value: 100 },
					{ field: "status", operator: "equals", value: "paid" },
				],
			});

			// Only first condition met
			const exec1 = await controller.execute(automation.id, {
				total: 200,
				status: "pending",
			});
			expect(exec1.status).toBe("skipped");

			// Only second condition met
			const exec2 = await controller.execute(automation.id, {
				total: 50,
				status: "paid",
			});
			expect(exec2.status).toBe("skipped");

			// Both conditions met
			const exec3 = await controller.execute(automation.id, {
				total: 200,
				status: "paid",
			});
			expect(exec3.status).toBe("completed");
		});

		it("three conditions all fail → skipped", async () => {
			const automation = await makeAutomation({
				status: "active",
				conditions: [
					{ field: "a", operator: "equals", value: "x" },
					{ field: "b", operator: "equals", value: "y" },
					{ field: "c", operator: "equals", value: "z" },
				],
			});

			const exec = await controller.execute(automation.id, {
				a: "x",
				b: "y",
				c: "WRONG",
			});
			expect(exec.status).toBe("skipped");
		});
	});

	// ── condition evaluation: empty conditions always pass ────────────────

	describe("condition evaluation: empty conditions", () => {
		it("automation with no conditions always executes", async () => {
			const automation = await makeAutomation({
				status: "active",
				conditions: [],
			});

			const exec1 = await controller.execute(automation.id, {});
			expect(exec1.status).toBe("completed");

			const exec2 = await controller.execute(automation.id, {
				irrelevant: "payload",
			});
			expect(exec2.status).toBe("completed");
		});

		it("automation created without conditions defaults to always execute", async () => {
			// create() defaults conditions to []
			const automation = await controller.create({
				name: "No conditions",
				triggerEvent: "order.placed",
				actions: [{ type: "log", config: {} }],
				status: "active",
			});

			const exec = await controller.execute(automation.id, {});
			expect(exec.status).toBe("completed");
		});
	});

	// ── execute: updates runCount and lastRunAt ───────────────────────────

	describe("execute: run statistics", () => {
		it("increments runCount with each execution", async () => {
			const automation = await makeAutomation({ status: "active" });

			await controller.execute(automation.id, {});
			const after1 = await controller.getById(automation.id);
			expect(after1?.runCount).toBe(1);

			await controller.execute(automation.id, {});
			const after2 = await controller.getById(automation.id);
			expect(after2?.runCount).toBe(2);
		});

		it("sets lastRunAt after execution", async () => {
			const automation = await makeAutomation({ status: "active" });
			expect(
				(await controller.getById(automation.id))?.lastRunAt,
			).toBeUndefined();

			await controller.execute(automation.id, {});

			const updated = await controller.getById(automation.id);
			expect(updated?.lastRunAt).toBeInstanceOf(Date);
		});

		it("does not increment runCount when execution is skipped (conditions not met)", async () => {
			const automation = await makeAutomation({
				status: "active",
				conditions: [{ field: "pass", operator: "equals", value: true }],
			});

			// Skipped execution
			const exec = await controller.execute(automation.id, { pass: false });
			expect(exec.status).toBe("skipped");

			// runCount should still be 0
			const updated = await controller.getById(automation.id);
			expect(updated?.runCount).toBe(0);
		});
	});

	// ── evaluateEvent: only active automations triggered ─────────────────

	describe("evaluateEvent: only active automations", () => {
		it("does not trigger draft automations", async () => {
			await makeAutomation({
				triggerEvent: "order.placed",
				status: "draft",
			});

			const executions = await controller.evaluateEvent("order.placed", {});
			expect(executions).toHaveLength(0);
		});

		it("does not trigger paused automations", async () => {
			const automation = await makeAutomation({
				triggerEvent: "order.placed",
				status: "active",
			});
			await controller.pause(automation.id);

			const executions = await controller.evaluateEvent("order.placed", {});
			expect(executions).toHaveLength(0);
		});

		it("triggers active automations matching the event type", async () => {
			await makeAutomation({
				name: "Active handler",
				triggerEvent: "order.placed",
				status: "active",
			});
			await makeAutomation({
				name: "Draft handler",
				triggerEvent: "order.placed",
				status: "draft",
			});
			await makeAutomation({
				name: "Different event",
				triggerEvent: "customer.created",
				status: "active",
			});

			const executions = await controller.evaluateEvent("order.placed", {});
			expect(executions).toHaveLength(1);
			expect(executions[0].status).toBe("completed");
		});

		it("triggers multiple active automations registered for the same event", async () => {
			await makeAutomation({
				name: "Handler A",
				triggerEvent: "customer.created",
				status: "active",
			});
			await makeAutomation({
				name: "Handler B",
				triggerEvent: "customer.created",
				status: "active",
			});

			const executions = await controller.evaluateEvent("customer.created", {});
			expect(executions).toHaveLength(2);
		});
	});

	// ── action validation ─────────────────────────────────────────────────

	describe("action validation: required fields per type", () => {
		it("send_notification fails without title", async () => {
			const automation = await makeAutomation({
				status: "active",
				actions: [{ type: "send_notification", config: { message: "Hello" } }],
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.status).toBe("failed");
			expect(exec.results[0].status).toBe("failed");
			expect(exec.results[0].error).toContain(
				"send_notification requires title and body/message",
			);
		});

		it("send_notification fails without message", async () => {
			const automation = await makeAutomation({
				status: "active",
				actions: [{ type: "send_notification", config: { title: "Alert" } }],
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.status).toBe("failed");
		});

		it("send_email fails without 'to' address", async () => {
			const automation = await makeAutomation({
				status: "active",
				actions: [{ type: "send_email", config: { subject: "Hello" } }],
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.status).toBe("failed");
			expect(exec.results[0].error).toContain(
				"send_email requires to and subject",
			);
		});

		it("send_email fails without subject", async () => {
			const automation = await makeAutomation({
				status: "active",
				actions: [{ type: "send_email", config: { to: "admin@store.com" } }],
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.status).toBe("failed");
		});

		it("webhook fails without url", async () => {
			const automation = await makeAutomation({
				status: "active",
				actions: [{ type: "webhook", config: {} }],
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.status).toBe("failed");
			expect(exec.results[0].error).toContain("webhook requires url");
		});

		it("update_field fails without entity", async () => {
			const automation = await makeAutomation({
				status: "active",
				actions: [
					{ type: "update_field", config: { field: "status", value: "x" } },
				],
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.status).toBe("failed");
			expect(exec.results[0].error).toContain(
				"update_field requires entity and field",
			);
		});

		it("update_field fails without field", async () => {
			const automation = await makeAutomation({
				status: "active",
				actions: [
					{ type: "update_field", config: { entity: "order", value: "x" } },
				],
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.status).toBe("failed");
		});

		it("create_record fails without entity", async () => {
			const automation = await makeAutomation({
				status: "active",
				actions: [{ type: "create_record", config: {} }],
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.status).toBe("failed");
			expect(exec.results[0].error).toContain("create_record requires entity");
		});

		it("log action always succeeds (no required config)", async () => {
			const automation = await makeAutomation({
				status: "active",
				actions: [{ type: "log", config: {} }],
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.status).toBe("completed");
			expect(exec.results[0].status).toBe("success");
		});

		it("mixed valid and invalid actions mark execution as failed with error summary", async () => {
			const automation = await makeAutomation({
				status: "active",
				actions: [
					{ type: "log", config: {} },
					{ type: "send_email", config: {} }, // missing to + subject
				],
			});
			const exec = await controller.execute(automation.id, {});
			expect(exec.status).toBe("failed");
			expect(exec.results[0].status).toBe("success");
			expect(exec.results[1].status).toBe("failed");
			expect(exec.error).toContain("send_email requires to and subject");
		});
	});

	// ── purgeExecutions ───────────────────────────────────────────────────

	describe("purgeExecutions", () => {
		it("removes executions older than the cutoff date", async () => {
			const automation = await makeAutomation({ status: "active" });
			const oldExec = await controller.execute(automation.id, {});

			// Backdate the execution to 60 days ago
			const sixtyDaysAgo = new Date();
			sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
			await mockData.upsert("automationExecution", oldExec.id, {
				...oldExec,
				startedAt: sixtyDaysAgo,
			} as Record<string, unknown>);

			// Create a recent execution
			await controller.execute(automation.id, {});

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			const deleted = await controller.purgeExecutions(cutoff);

			expect(deleted).toBe(1);

			const remaining = await controller.listExecutions();
			expect(remaining.total).toBe(1);
		});

		it("does not remove executions newer than the cutoff", async () => {
			const automation = await makeAutomation({ status: "active" });
			await controller.execute(automation.id, {});
			await controller.execute(automation.id, {});

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			const deleted = await controller.purgeExecutions(cutoff);

			expect(deleted).toBe(0);

			const remaining = await controller.listExecutions();
			expect(remaining.total).toBe(2);
		});

		it("returns 0 when there are no executions to purge", async () => {
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 7);
			const deleted = await controller.purgeExecutions(cutoff);
			expect(deleted).toBe(0);
		});

		it("removes all old executions across multiple automations", async () => {
			const a1 = await makeAutomation({ status: "active" });
			const a2 = await makeAutomation({
				name: "Second",
				status: "active",
			});

			const exec1 = await controller.execute(a1.id, {});
			const exec2 = await controller.execute(a2.id, {});

			const veryOld = new Date();
			veryOld.setDate(veryOld.getDate() - 90);

			await mockData.upsert("automationExecution", exec1.id, {
				...exec1,
				startedAt: veryOld,
			} as Record<string, unknown>);
			await mockData.upsert("automationExecution", exec2.id, {
				...exec2,
				startedAt: veryOld,
			} as Record<string, unknown>);

			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			const deleted = await controller.purgeExecutions(cutoff);

			expect(deleted).toBe(2);

			const remaining = await controller.listExecutions();
			expect(remaining.total).toBe(0);
		});
	});
});
