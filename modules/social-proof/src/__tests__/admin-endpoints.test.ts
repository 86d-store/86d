import { describe, expect, it, vi } from "vitest";
import { activitySummary } from "../admin/endpoints/activity-summary";
import { cleanupEvents } from "../admin/endpoints/cleanup-events";
import { createBadge } from "../admin/endpoints/create-badge";
import { deleteBadge } from "../admin/endpoints/delete-badge";
import { adminListBadges } from "../admin/endpoints/list-badges";
import { adminListEvents } from "../admin/endpoints/list-events";
import { updateBadge } from "../admin/endpoints/update-badge";
import type {
	ActivityEvent,
	ActivitySummary,
	SocialProofController,
	TrustBadge,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeBadge(overrides: Partial<TrustBadge> = {}): TrustBadge {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Secure Checkout",
		icon: "shield",
		position: "checkout",
		priority: 10,
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
	return {
		id: crypto.randomUUID(),
		productId: "prod-1",
		productName: "Widget",
		productSlug: "widget",
		eventType: "purchase",
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<SocialProofController> = {},
): SocialProofController {
	const defaultSummary: ActivitySummary = {
		totalEvents: 0,
		totalPurchases: 0,
		totalViews: 0,
		totalCartAdds: 0,
		uniqueProducts: 0,
		topProducts: [],
	};
	return {
		recordEvent: vi.fn().mockResolvedValue(makeEvent()),
		getProductActivity: vi.fn().mockResolvedValue(null),
		getRecentActivity: vi.fn().mockResolvedValue([]),
		getTrendingProducts: vi.fn().mockResolvedValue([]),
		createBadge: vi.fn().mockResolvedValue(makeBadge()),
		getBadge: vi.fn().mockResolvedValue(null),
		updateBadge: vi.fn().mockResolvedValue(null),
		deleteBadge: vi.fn().mockResolvedValue(false),
		listBadges: vi.fn().mockResolvedValue([]),
		countBadges: vi.fn().mockResolvedValue(0),
		listEvents: vi.fn().mockResolvedValue([]),
		countEvents: vi.fn().mockResolvedValue(0),
		cleanupEvents: vi.fn().mockResolvedValue(0),
		getActivitySummary: vi.fn().mockResolvedValue(defaultSummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: SocialProofController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { socialProof: opts.controller ?? makeController() },
		},
	});
}

const listBadgesHandler = extractHandler(adminListBadges);
const createBadgeHandler = extractHandler(createBadge);
const updateBadgeHandler = extractHandler(updateBadge);
const deleteBadgeHandler = extractHandler(deleteBadge);
const listEventsHandler = extractHandler(adminListEvents);
const cleanupHandler = extractHandler(cleanupEvents);
const summaryHandler = extractHandler(activitySummary);

describe("admin GET /social-proof/badges", () => {
	it("returns empty badges and zero total", async () => {
		const result = (await call(listBadgesHandler)) as {
			badges: TrustBadge[];
			total: number;
		};
		expect(result.badges).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards position filter to controller", async () => {
		const ctrl = makeController();
		await call(listBadgesHandler, {
			query: { position: "product" },
			controller: ctrl,
		});
		expect(ctrl.listBadges).toHaveBeenCalledWith(
			expect.objectContaining({ position: "product" }),
		);
	});
});

describe("admin POST /social-proof/badges/create", () => {
	it("creates badge and returns it", async () => {
		const badge = makeBadge({ name: "Free Returns" });
		const ctrl = makeController({
			createBadge: vi.fn().mockResolvedValue(badge),
		});
		const result = (await call(createBadgeHandler, {
			body: { name: "Free Returns", icon: "arrow-left", position: "product" },
			controller: ctrl,
		})) as { badge: TrustBadge };
		expect(result.badge.name).toBe("Free Returns");
	});

	it("calls controller with correct params", async () => {
		const ctrl = makeController();
		await call(createBadgeHandler, {
			body: {
				name: "Verified",
				icon: "check",
				position: "footer",
				isActive: true,
			},
			controller: ctrl,
		});
		expect(ctrl.createBadge).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Verified", position: "footer" }),
		);
	});
});

describe("admin POST /social-proof/badges/:id/update", () => {
	it("returns 404 when badge not found", async () => {
		const result = (await call(updateBadgeHandler, {
			params: { id: "missing" },
			body: { name: "Updated" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates badge and returns it", async () => {
		const badge = makeBadge({ name: "Updated Badge" });
		const ctrl = makeController({
			updateBadge: vi.fn().mockResolvedValue(badge),
		});
		const result = (await call(updateBadgeHandler, {
			params: { id: badge.id },
			body: { name: "Updated Badge" },
			controller: ctrl,
		})) as { badge: TrustBadge };
		expect(result.badge.name).toBe("Updated Badge");
	});
});

describe("admin POST /social-proof/badges/:id/delete", () => {
	it("returns 404 when badge not found", async () => {
		const result = (await call(deleteBadgeHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns success when badge is deleted", async () => {
		const ctrl = makeController({
			deleteBadge: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteBadgeHandler, {
			params: { id: "b1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin GET /social-proof/events", () => {
	it("returns empty events and zero total", async () => {
		const result = (await call(listEventsHandler)) as {
			events: ActivityEvent[];
			total: number;
		};
		expect(result.events).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards eventType filter to controller", async () => {
		const ctrl = makeController();
		await call(listEventsHandler, {
			query: { eventType: "view" },
			controller: ctrl,
		});
		expect(ctrl.listEvents).toHaveBeenCalledWith(
			expect.objectContaining({ eventType: "view" }),
		);
	});
});

describe("admin POST /social-proof/events/cleanup", () => {
	it("returns deleted count of 0 when no old events", async () => {
		const result = (await call(cleanupHandler, {
			body: { olderThanDays: 30 },
		})) as { deleted: number; success: boolean };
		expect(result.deleted).toBe(0);
		expect(result.success).toBe(true);
	});

	it("returns deleted count when events removed", async () => {
		const ctrl = makeController({
			cleanupEvents: vi.fn().mockResolvedValue(15),
		});
		const result = (await call(cleanupHandler, {
			body: { olderThanDays: 7 },
			controller: ctrl,
		})) as { deleted: number };
		expect(result.deleted).toBe(15);
	});
});

describe("admin GET /social-proof/summary", () => {
	it("returns zero-state summary", async () => {
		const result = (await call(summaryHandler)) as { summary: ActivitySummary };
		expect(result.summary.totalEvents).toBe(0);
	});

	it("returns real summary stats", async () => {
		const ctrl = makeController({
			getActivitySummary: vi.fn().mockResolvedValue({
				totalEvents: 100,
				totalPurchases: 20,
				totalViews: 70,
				totalCartAdds: 10,
				uniqueProducts: 5,
				topProducts: [],
			}),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: ActivitySummary;
		};
		expect(result.summary.totalEvents).toBe(100);
	});
});
