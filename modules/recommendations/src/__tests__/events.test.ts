import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createRecommendationController } from "../service-impl";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

// ---------------------------------------------------------------------------
// recommendation.interaction.tracked
// ---------------------------------------------------------------------------

describe("recommendation.interaction.tracked event", () => {
	it("emits when a view interaction is tracked", async () => {
		const events = createMockEvents();
		const ctrl = createRecommendationController(
			createMockDataService(),
			events,
		);

		await ctrl.trackInteraction({
			productId: "p1",
			customerId: "c1",
			type: "view",
			productName: "Widget",
			productSlug: "widget",
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("recommendation.interaction.tracked");
		expect(events.emitted[0].payload).toEqual({
			productId: "p1",
			type: "view",
			customerId: "c1",
			sessionId: undefined,
		});
	});

	it("emits with sessionId when no customerId", async () => {
		const events = createMockEvents();
		const ctrl = createRecommendationController(
			createMockDataService(),
			events,
		);

		await ctrl.trackInteraction({
			productId: "p1",
			sessionId: "sess-1",
			type: "add_to_cart",
			productName: "Widget",
			productSlug: "widget",
		});

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.sessionId).toBe("sess-1");
		expect(payload.customerId).toBeUndefined();
		expect(payload.type).toBe("add_to_cart");
	});

	it("emits for purchase interactions", async () => {
		const events = createMockEvents();
		const ctrl = createRecommendationController(
			createMockDataService(),
			events,
		);

		await ctrl.trackInteraction({
			productId: "p1",
			customerId: "c1",
			type: "purchase",
			productName: "Widget",
			productSlug: "widget",
		});

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.type).toBe("purchase");
	});

	it("emits once per interaction", async () => {
		const events = createMockEvents();
		const ctrl = createRecommendationController(
			createMockDataService(),
			events,
		);

		await ctrl.trackInteraction({
			productId: "p1",
			customerId: "c1",
			type: "view",
			productName: "A",
			productSlug: "a",
		});
		await ctrl.trackInteraction({
			productId: "p2",
			customerId: "c1",
			type: "purchase",
			productName: "B",
			productSlug: "b",
		});

		expect(events.emitted).toHaveLength(2);
		expect(events.emitted[0].type).toBe("recommendation.interaction.tracked");
		expect(events.emitted[1].type).toBe("recommendation.interaction.tracked");
	});
});

// ---------------------------------------------------------------------------
// recommendation.served
// ---------------------------------------------------------------------------

describe("recommendation.served event", () => {
	it("emits when getForProduct returns results via manual rules", async () => {
		const events = createMockEvents();
		const ctrl = createRecommendationController(
			createMockDataService(),
			events,
		);

		await ctrl.createRule({
			name: "Test",
			strategy: "manual",
			sourceProductId: "p1",
			targetProductIds: ["p2", "p3"],
			weight: 5,
		});
		events.emitted.length = 0;

		await ctrl.getForProduct("p1");

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("recommendation.served");
		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.productId).toBe("p1");
		expect(payload.count).toBe(2);
		expect(payload.strategies).toEqual(["manual"]);
	});

	it("does not emit when no results returned", async () => {
		const events = createMockEvents();
		const ctrl = createRecommendationController(
			createMockDataService(),
			events,
		);

		await ctrl.getForProduct("p-no-rules");

		expect(
			events.emitted.filter((e) => e.type === "recommendation.served"),
		).toHaveLength(0);
	});

	it("emits with bought_together strategy", async () => {
		const events = createMockEvents();
		const ctrl = createRecommendationController(
			createMockDataService(),
			events,
		);

		await ctrl.recordPurchase(["p1", "p2", "p3"]);
		events.emitted.length = 0;

		await ctrl.getForProduct("p1");

		expect(events.emitted).toHaveLength(1);
		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.productId).toBe("p1");
		expect(payload.count).toBe(2);
		expect(payload.strategies).toEqual(["bought_together"]);
	});

	it("emits with combined strategies", async () => {
		const events = createMockEvents();
		const ctrl = createRecommendationController(
			createMockDataService(),
			events,
		);

		await ctrl.createRule({
			name: "Manual",
			strategy: "manual",
			sourceProductId: "p1",
			targetProductIds: ["p2"],
		});
		await ctrl.recordPurchase(["p1", "p3"]);
		events.emitted.length = 0;

		await ctrl.getForProduct("p1");

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.count).toBe(2);
		const strategies = payload.strategies as string[];
		expect(strategies).toContain("manual");
		expect(strategies).toContain("bought_together");
	});

	it("does not emit for inactive rules", async () => {
		const events = createMockEvents();
		const ctrl = createRecommendationController(
			createMockDataService(),
			events,
		);

		await ctrl.createRule({
			name: "Inactive",
			strategy: "manual",
			sourceProductId: "p1",
			targetProductIds: ["p2"],
			isActive: false,
		});
		events.emitted.length = 0;

		await ctrl.getForProduct("p1");

		expect(
			events.emitted.filter((e) => e.type === "recommendation.served"),
		).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// No events without emitter
// ---------------------------------------------------------------------------

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createRecommendationController(createMockDataService());

		await ctrl.trackInteraction({
			productId: "p1",
			customerId: "c1",
			type: "view",
			productName: "Widget",
			productSlug: "widget",
		});
		await ctrl.createRule({
			name: "Test",
			strategy: "manual",
			sourceProductId: "p1",
			targetProductIds: ["p2"],
		});
		await ctrl.recordPurchase(["p1", "p2"]);
		await ctrl.getForProduct("p1");

		// No errors thrown
	});
});

// ---------------------------------------------------------------------------
// Full lifecycle
// ---------------------------------------------------------------------------

describe("full lifecycle event sequence", () => {
	it("emits interaction and served events in order", async () => {
		const events = createMockEvents();
		const ctrl = createRecommendationController(
			createMockDataService(),
			events,
		);

		await ctrl.trackInteraction({
			productId: "p1",
			customerId: "c1",
			type: "view",
			productName: "A",
			productSlug: "a",
		});

		await ctrl.createRule({
			name: "Manual",
			strategy: "manual",
			sourceProductId: "p1",
			targetProductIds: ["p2"],
		});

		await ctrl.getForProduct("p1");

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"recommendation.interaction.tracked",
			"recommendation.served",
		]);
	});
});
