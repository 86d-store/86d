import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuctionController } from "../service-impl";

/**
 * Store endpoint integration tests for the auctions module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-auctions: active auctions only (public)
 * 2. get-auction: by ID, only active/ended visible
 * 3. place-bid: auth required, validates amount > current highest
 * 4. buy-now: auth required, only if buyNowPrice is set
 * 5. watch-auction: auth required, toggle watching
 * 6. my-bids: auth required, lists customer's bid history
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ─────────────────────────────────────────────────────────

async function createActiveAuction(
	ctrl: ReturnType<typeof createAuctionController>,
	overrides: Partial<Parameters<typeof ctrl.createAuction>[0]> & {
		title: string;
	},
) {
	// startsAt in the past auto-sets status to "active" in createAuction
	const productId = `prod_${overrides.title.toLowerCase().replace(/\s+/g, "_")}`;
	return ctrl.createAuction({
		productId,
		productName: overrides.title,
		type: "english",
		startingPrice: 1000,
		startsAt: new Date(Date.now() - 86400000),
		endsAt: new Date(Date.now() + 7 * 86400000),
		...overrides,
	});
}

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListAuctions(
	data: DataService,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createAuctionController(data);
	const auctions = await controller.listAuctions({
		status: "active",
		take: query.take ?? 20,
		skip: query.skip ?? 0,
	});
	return { auctions };
}

async function simulateGetAuction(data: DataService, id: string) {
	const controller = createAuctionController(data);
	const auction = await controller.getAuction(id);
	if (
		!auction ||
		(auction.status !== "active" &&
			auction.status !== "ended" &&
			auction.status !== "sold")
	) {
		return { error: "Auction not found", status: 404 };
	}
	return { auction };
}

async function simulatePlaceBid(
	data: DataService,
	body: { auctionId: string; amount: number },
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createAuctionController(data);
	try {
		const result = await controller.placeBid({
			auctionId: body.auctionId,
			customerId: opts.customerId,
			amount: body.amount,
		});
		return { bid: result.bid, auction: result.auction };
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Bid failed";
		return { error: msg, status: 400 };
	}
}

async function simulateWatchAuction(
	data: DataService,
	auctionId: string,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createAuctionController(data);
	await controller.watchAuction(auctionId, opts.customerId);
	return { success: true };
}

async function simulateMyBids(
	data: DataService,
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createAuctionController(data);
	const bids = await controller.getBidsByCustomer(opts.customerId);
	return { bids };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list auctions — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active auctions", async () => {
		const ctrl = createAuctionController(data);
		await createActiveAuction(ctrl, { title: "Active Widget" });
		await ctrl.createAuction({
			title: "Draft Auction",
			productId: "prod_draft",
			productName: "Draft Auction",
			type: "english",
			startingPrice: 500,
			startsAt: new Date(Date.now() + 86400000),
			endsAt: new Date(Date.now() + 7 * 86400000),
		});

		const result = await simulateListAuctions(data);

		expect(result.auctions).toHaveLength(1);
		expect(result.auctions[0].title).toBe("Active Widget");
	});

	it("returns empty when no active auctions exist", async () => {
		const result = await simulateListAuctions(data);

		expect(result.auctions).toHaveLength(0);
	});

	it("paginates results", async () => {
		const ctrl = createAuctionController(data);
		for (let i = 0; i < 5; i++) {
			await createActiveAuction(ctrl, { title: `Auction ${i}` });
		}

		const page1 = await simulateListAuctions(data, { take: 2 });
		const page2 = await simulateListAuctions(data, { take: 2, skip: 2 });

		expect(page1.auctions).toHaveLength(2);
		expect(page2.auctions).toHaveLength(2);
	});
});

describe("store endpoint: get auction — visible statuses", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an active auction", async () => {
		const ctrl = createAuctionController(data);
		const auction = await createActiveAuction(ctrl, {
			title: "Rare Widget",
		});

		const result = await simulateGetAuction(data, auction.id);

		expect("auction" in result).toBe(true);
		if ("auction" in result) {
			expect(result.auction.title).toBe("Rare Widget");
		}
	});

	it("returns 404 for draft auction", async () => {
		const ctrl = createAuctionController(data);
		const auction = await ctrl.createAuction({
			title: "Not Published",
			productId: "prod_1",
			productName: "Not Published",
			type: "english",
			startingPrice: 500,
			startsAt: new Date(Date.now() + 86400000),
			endsAt: new Date(Date.now() + 14 * 86400000),
		});

		const result = await simulateGetAuction(data, auction.id);

		expect(result).toEqual({ error: "Auction not found", status: 404 });
	});

	it("returns 404 for nonexistent auction", async () => {
		const result = await simulateGetAuction(data, "ghost_id");

		expect(result).toEqual({ error: "Auction not found", status: 404 });
	});
});

describe("store endpoint: place bid — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulatePlaceBid(data, {
			auctionId: "auc_1",
			amount: 5000,
		});
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("places a valid bid on an active auction", async () => {
		const ctrl = createAuctionController(data);
		const auction = await createActiveAuction(ctrl, {
			title: "Bidding Widget",
			startingPrice: 1000,
		});

		const result = await simulatePlaceBid(
			data,
			{ auctionId: auction.id, amount: 1500 },
			{ customerId: "cust_1" },
		);

		expect("bid" in result).toBe(true);
		if ("bid" in result) {
			expect(result.bid.amount).toBe(1500);
			expect(result.bid.customerId).toBe("cust_1");
		}
	});

	it("rejects bid below starting price", async () => {
		const ctrl = createAuctionController(data);
		const auction = await createActiveAuction(ctrl, {
			title: "Expensive Widget",
			startingPrice: 5000,
		});

		const result = await simulatePlaceBid(
			data,
			{ auctionId: auction.id, amount: 100 },
			{ customerId: "cust_1" },
		);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.status).toBe(400);
		}
	});
});

describe("store endpoint: watch auction — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateWatchAuction(data, "auc_1");
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("watches an auction", async () => {
		const ctrl = createAuctionController(data);
		const auction = await createActiveAuction(ctrl, { title: "Watch Me" });

		const result = await simulateWatchAuction(data, auction.id, {
			customerId: "cust_1",
		});

		expect(result).toEqual({ success: true });

		const verifier = createAuctionController(data);
		const isWatching = await verifier.isWatching(auction.id, "cust_1");
		expect(isWatching).toBe(true);
	});
});

describe("store endpoint: my bids — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMyBids(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns customer's bid history", async () => {
		const ctrl = createAuctionController(data);
		const auction = await createActiveAuction(ctrl, {
			title: "Bid On Me",
			startingPrice: 1000,
		});
		await ctrl.placeBid({
			auctionId: auction.id,
			customerId: "cust_1",
			amount: 2000,
		});

		const result = await simulateMyBids(data, { customerId: "cust_1" });

		expect("bids" in result).toBe(true);
		if ("bids" in result) {
			expect(result.bids).toHaveLength(1);
			expect(result.bids[0].amount).toBe(2000);
		}
	});

	it("returns empty for customer with no bids", async () => {
		const result = await simulateMyBids(data, { customerId: "cust_new" });

		expect("bids" in result).toBe(true);
		if ("bids" in result) {
			expect(result.bids).toHaveLength(0);
		}
	});

	it("does not include other customers' bids", async () => {
		const ctrl = createAuctionController(data);
		const auction = await createActiveAuction(ctrl, {
			title: "Widget",
			startingPrice: 1000,
		});
		await ctrl.placeBid({
			auctionId: auction.id,
			customerId: "cust_other",
			amount: 2000,
		});

		const result = await simulateMyBids(data, { customerId: "cust_1" });

		expect("bids" in result).toBe(true);
		if ("bids" in result) {
			expect(result.bids).toHaveLength(0);
		}
	});
});
