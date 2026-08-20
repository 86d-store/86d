import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import type { CheckoutLineItem } from "../service";
import { createCheckoutController } from "../service-impl";

const sampleAddress = {
	firstName: "Jane",
	lastName: "Doe",
	line1: "1 Main St",
	city: "Springfield",
	state: "IL",
	postalCode: "62701",
	country: "US",
};

const sampleLineItems: CheckoutLineItem[] = [
	{ productId: "p1", name: "Widget", price: 1000, quantity: 2 },
	{
		productId: "p2",
		variantId: "v1",
		name: "Gadget S",
		sku: "GAD-S",
		price: 2000,
		quantity: 1,
	},
];

function makeSession(overrides: Record<string, unknown> = {}) {
	return {
		subtotal: 4000,
		taxAmount: 400,
		shippingAmount: 500,
		total: 4900,
		lineItems: sampleLineItems,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// listSessions
// ---------------------------------------------------------------------------

describe("listSessions", () => {
	it("returns empty list when no sessions exist", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const result = await ctrl.listSessions({});
		expect(result.sessions).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("lists all sessions", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession({ guestEmail: "a@test.com" }));
		await ctrl.create(makeSession({ guestEmail: "b@test.com" }));
		await ctrl.create(makeSession({ guestEmail: "c@test.com" }));

		const result = await ctrl.listSessions({});
		expect(result.sessions).toHaveLength(3);
		expect(result.total).toBe(3);
	});

	it("filters by status", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession());
		const s2 = await ctrl.create(
			makeSession({
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(s2.id);

		const pending = await ctrl.listSessions({ status: "pending" });
		expect(pending.sessions).toHaveLength(1);
		expect(pending.sessions[0].status).toBe("pending");

		const processing = await ctrl.listSessions({ status: "processing" });
		expect(processing.sessions).toHaveLength(1);
		expect(processing.sessions[0].status).toBe("processing");
	});

	it("searches by email", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession({ guestEmail: "alice@example.com" }));
		await ctrl.create(makeSession({ guestEmail: "bob@example.com" }));

		const result = await ctrl.listSessions({ search: "alice" });
		expect(result.sessions).toHaveLength(1);
		expect(result.total).toBe(1);
	});

	it("searches by session ID prefix", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const s1 = await ctrl.create(makeSession({ id: "sess-abc-123" }));
		await ctrl.create(makeSession({ id: "sess-def-456" }));

		const result = await ctrl.listSessions({ search: "abc" });
		expect(result.sessions).toHaveLength(1);
		expect(result.sessions[0].id).toBe(s1.id);
	});

	it("searches by customerId", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession({ customerId: "cust-alice-1" }));
		await ctrl.create(makeSession({ customerId: "cust-bob-2" }));

		const result = await ctrl.listSessions({ search: "alice" });
		expect(result.sessions).toHaveLength(1);
	});

	it("paginates with take and skip", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		for (let i = 0; i < 5; i++) {
			await ctrl.create(makeSession({ guestEmail: `user${i}@test.com` }));
		}

		const page1 = await ctrl.listSessions({ take: 2, skip: 0 });
		expect(page1.sessions).toHaveLength(2);
		expect(page1.total).toBe(5);

		const page2 = await ctrl.listSessions({ take: 2, skip: 2 });
		expect(page2.sessions).toHaveLength(2);

		const page3 = await ctrl.listSessions({ take: 2, skip: 4 });
		expect(page3.sessions).toHaveLength(1);
	});

	it("combines status filter and search", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const s1 = await ctrl.create(
			makeSession({
				guestEmail: "alice@example.com",
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(s1.id);
		await ctrl.create(makeSession({ guestEmail: "alice@other.com" }));

		const result = await ctrl.listSessions({
			status: "processing",
			search: "alice",
		});
		expect(result.sessions).toHaveLength(1);
		expect(result.sessions[0].status).toBe("processing");
	});

	it("search is case-insensitive", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		await ctrl.create(makeSession({ guestEmail: "Alice@Example.COM" }));

		const result = await ctrl.listSessions({ search: "alice@example" });
		expect(result.sessions).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

describe("getStats", () => {
	it("returns zeros when no sessions exist", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const stats = await ctrl.getStats();

		expect(stats.total).toBe(0);
		expect(stats.pending).toBe(0);
		expect(stats.processing).toBe(0);
		expect(stats.completed).toBe(0);
		expect(stats.abandoned).toBe(0);
		expect(stats.expired).toBe(0);
		expect(stats.conversionRate).toBe(0);
		expect(stats.totalRevenue).toBe(0);
		expect(stats.averageOrderValue).toBe(0);
	});

	it("counts sessions by status", async () => {
		const ctrl = createCheckoutController(createMockDataService());

		// Create 3 pending
		await ctrl.create(makeSession());
		await ctrl.create(makeSession());
		await ctrl.create(makeSession());

		// 1 processing
		const processing = await ctrl.create(
			makeSession({
				customerId: "cust-1",
				shippingAddress: sampleAddress,
			}),
		);
		await ctrl.confirm(processing.id);

		// 1 completed
		const completed = await ctrl.create(makeSession());
		await ctrl.complete(completed.id, "order-1");

		// 1 abandoned
		const abandoned = await ctrl.create(makeSession());
		await ctrl.abandon(abandoned.id);

		const stats = await ctrl.getStats();
		expect(stats.total).toBe(6);
		expect(stats.pending).toBe(3);
		expect(stats.processing).toBe(1);
		expect(stats.completed).toBe(1);
		expect(stats.abandoned).toBe(1);
	});

	it("calculates conversion rate correctly", async () => {
		const ctrl = createCheckoutController(createMockDataService());

		// 2 completed
		const c1 = await ctrl.create(makeSession());
		await ctrl.complete(c1.id, "order-1");
		const c2 = await ctrl.create(makeSession());
		await ctrl.complete(c2.id, "order-2");

		// 3 abandoned
		const a1 = await ctrl.create(makeSession());
		await ctrl.abandon(a1.id);
		const a2 = await ctrl.create(makeSession());
		await ctrl.abandon(a2.id);
		const a3 = await ctrl.create(makeSession());
		await ctrl.abandon(a3.id);

		// 1 expired
		await ctrl.create(makeSession({ ttl: -60_000 }));
		await ctrl.expireStale();

		const stats = await ctrl.getStats();
		// terminated = completed(2) + abandoned(3) + expired(1) = 6
		// conversion = 2/6 ≈ 0.333
		expect(stats.conversionRate).toBeCloseTo(2 / 6, 3);
	});

	it("calculates revenue and average order value", async () => {
		const ctrl = createCheckoutController(createMockDataService());

		// total=4900
		const c1 = await ctrl.create(makeSession());
		await ctrl.complete(c1.id, "order-1");

		// total=3000
		const c2 = await ctrl.create(
			makeSession({
				subtotal: 2500,
				taxAmount: 300,
				shippingAmount: 200,
				total: 3000,
			}),
		);
		await ctrl.complete(c2.id, "order-2");

		// abandoned — should NOT count toward revenue
		const a = await ctrl.create(makeSession());
		await ctrl.abandon(a.id);

		const stats = await ctrl.getStats();
		expect(stats.totalRevenue).toBe(4900 + 3000);
		expect(stats.averageOrderValue).toBe((4900 + 3000) / 2);
		expect(stats.completed).toBe(2);
	});

	it("excludes pending and processing from conversion rate", async () => {
		const ctrl = createCheckoutController(createMockDataService());

		// Only pending — no terminated sessions
		await ctrl.create(makeSession());
		await ctrl.create(makeSession());

		const stats = await ctrl.getStats();
		expect(stats.conversionRate).toBe(0);
		expect(stats.total).toBe(2);
		expect(stats.pending).toBe(2);
	});

	it("handles expired sessions in count", async () => {
		const ctrl = createCheckoutController(createMockDataService());

		await ctrl.create(makeSession({ ttl: -60_000 }));
		await ctrl.create(makeSession({ ttl: -60_000 }));
		await ctrl.expireStale();

		const stats = await ctrl.getStats();
		expect(stats.expired).toBe(2);
		expect(stats.total).toBe(2);
		expect(stats.conversionRate).toBe(0); // 0 completed / 2 expired
	});
});
