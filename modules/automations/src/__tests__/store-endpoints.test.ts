import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAutomationsController } from "../service-impl";

/**
 * Store endpoint integration tests for the automations module.
 *
 * These tests verify the business logic in endpoints:
 *
 * 1. evaluate-event: triggers matching automations for an event
 * 2. list: returns automations with pagination
 * 3. get-stats: returns automation statistics
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateEvaluateEvent(
	data: DataService,
	eventType: string,
	payload: Record<string, unknown>,
) {
	const controller = createAutomationsController(data);
	const executions = await controller.evaluateEvent(eventType, payload);
	return { executions };
}

async function simulateList(
	data: DataService,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createAutomationsController(data);
	const result = await controller.list(query);
	return result;
}

async function simulateGetStats(data: DataService) {
	const controller = createAutomationsController(data);
	const stats = await controller.getStats();
	return { stats };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: evaluate event", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns empty when no automations match", async () => {
		const result = await simulateEvaluateEvent(data, "order.created", {
			orderId: "order_1",
		});

		expect(result.executions).toHaveLength(0);
	});

	it("triggers matching automation", async () => {
		const ctrl = createAutomationsController(data);
		const auto = await ctrl.create({
			name: "Welcome Email",
			triggerEvent: "order.created",
			actions: [{ type: "send_email", config: { template: "welcome" } }],
		});
		await ctrl.activate(auto.id);

		const result = await simulateEvaluateEvent(data, "order.created", {
			orderId: "order_1",
		});

		expect(result.executions.length).toBeGreaterThanOrEqual(1);
	});
});

describe("store endpoint: list automations", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns automations with total count", async () => {
		const ctrl = createAutomationsController(data);
		await ctrl.create({
			name: "Auto 1",
			triggerEvent: "order.created",
			actions: [{ type: "log", config: {} }],
		});
		await ctrl.create({
			name: "Auto 2",
			triggerEvent: "order.shipped",
			actions: [{ type: "log", config: {} }],
		});

		const result = await simulateList(data);

		expect(result.automations).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("returns empty when no automations", async () => {
		const result = await simulateList(data);

		expect(result.automations).toHaveLength(0);
	});
});

describe("store endpoint: get stats", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns automation statistics", async () => {
		const ctrl = createAutomationsController(data);
		await ctrl.create({
			name: "Auto",
			triggerEvent: "order.created",
			actions: [{ type: "log", config: {} }],
		});

		const result = await simulateGetStats(data);

		expect(result.stats.totalAutomations).toBe(1);
	});
});
