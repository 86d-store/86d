import { describe, expect, it, vi } from "vitest";
import { deleteEntry } from "../admin/endpoints/delete-entry";
import { listWaitlist } from "../admin/endpoints/list-waitlist";
import { notifyWaitlist } from "../admin/endpoints/notify-waitlist";
import { waitlistSummary } from "../admin/endpoints/waitlist-summary";
import type {
	WaitlistController,
	WaitlistEntry,
	WaitlistSummary,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeEntry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
	return {
		id: crypto.randomUUID(),
		productId: "prod-1",
		productName: "Blue Widget",
		email: "customer@example.com",
		status: "waiting",
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<WaitlistController> = {},
): WaitlistController {
	const defaultSummary: WaitlistSummary = {
		totalWaiting: 0,
		totalNotified: 0,
		topProducts: [],
	};
	return {
		subscribe: vi.fn().mockResolvedValue(makeEntry()),
		unsubscribe: vi.fn().mockResolvedValue(false),
		cancelByEmail: vi.fn().mockResolvedValue(false),
		getEntry: vi.fn().mockResolvedValue(null),
		isSubscribed: vi.fn().mockResolvedValue(false),
		listByProduct: vi.fn().mockResolvedValue([]),
		listByEmail: vi.fn().mockResolvedValue([]),
		listAll: vi.fn().mockResolvedValue([]),
		countByProduct: vi.fn().mockResolvedValue(0),
		markNotified: vi.fn().mockResolvedValue(0),
		markPurchased: vi.fn().mockResolvedValue(false),
		getSummary: vi.fn().mockResolvedValue(defaultSummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: WaitlistController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { waitlist: opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(listWaitlist);
const deleteHandler = extractHandler(deleteEntry);
const notifyHandler = extractHandler(notifyWaitlist);
const summaryHandler = extractHandler(waitlistSummary);

describe("admin GET /waitlist", () => {
	it("returns empty entries list", async () => {
		const result = (await call(listHandler)) as {
			entries: WaitlistEntry[];
			total: number;
		};
		expect(result.entries).toHaveLength(0);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { status: "notified" },
			controller: ctrl,
		});
		expect(ctrl.listAll).toHaveBeenCalledWith(
			expect.objectContaining({ status: "notified" }),
		);
	});
});

describe("admin POST /waitlist/:id/delete", () => {
	it("returns deleted=false when entry not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
			body: {},
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted=true when entry removed", async () => {
		const ctrl = makeController({
			unsubscribe: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "e1" },
			body: {},
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

describe("admin POST /waitlist/:productId/notify", () => {
	it("returns notifiedCount of 0 when no waiting entries", async () => {
		const result = (await call(notifyHandler, {
			params: { productId: "prod-1" },
			body: { productId: "prod-1" },
		})) as { notifiedCount: number };
		expect(result.notifiedCount).toBe(0);
	});

	it("returns correct notifiedCount", async () => {
		const ctrl = makeController({ markNotified: vi.fn().mockResolvedValue(5) });
		const result = (await call(notifyHandler, {
			params: { productId: "prod-1" },
			body: { productId: "prod-1" },
			controller: ctrl,
		})) as { notifiedCount: number };
		expect(result.notifiedCount).toBe(5);
	});
});

describe("admin GET /waitlist/summary", () => {
	it("returns summary with zero totals", async () => {
		const result = (await call(summaryHandler)) as { summary: WaitlistSummary };
		expect(result.summary.totalWaiting).toBe(0);
	});

	it("returns real summary stats", async () => {
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue({
				totalWaiting: 12,
				totalNotified: 3,
				topProducts: [{ productId: "p1", productName: "Widget", count: 12 }],
			}),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: WaitlistSummary;
		};
		expect(result.summary.totalWaiting).toBe(12);
		expect(result.summary.topProducts).toHaveLength(1);
	});
});
