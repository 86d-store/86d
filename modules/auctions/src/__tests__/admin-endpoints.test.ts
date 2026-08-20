import { describe, expect, it, vi } from "vitest";
import { auctionSummary } from "../admin/endpoints/auction-summary";
import { cancelAuction } from "../admin/endpoints/cancel-auction";
import { closeAuction } from "../admin/endpoints/close-auction";
import { createAuction } from "../admin/endpoints/create-auction";
import { deleteAuction } from "../admin/endpoints/delete-auction";
import { getAuction } from "../admin/endpoints/get-auction";
import { listAuctions } from "../admin/endpoints/list-auctions";
import { listBids } from "../admin/endpoints/list-bids";
import { publishAuction } from "../admin/endpoints/publish-auction";
import { updateAuction } from "../admin/endpoints/update-auction";
import type {
	Auction,
	AuctionController,
	AuctionSummary,
	AuctionType,
	Bid,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeAuction(overrides: Partial<Auction> = {}): Auction {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		title: "Vintage Watch",
		productId: "prod_1",
		productName: "Omega Seamaster",
		type: "english" as AuctionType,
		status: "active",
		startingPrice: 10000,
		reservePrice: 0,
		buyNowPrice: 0,
		bidIncrement: 100,
		currentBid: 0,
		bidCount: 0,
		antiSnipingEnabled: false,
		antiSnipingMinutes: 5,
		startsAt: now,
		endsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeBid(auctionId: string, overrides: Partial<Bid> = {}): Bid {
	return {
		id: crypto.randomUUID(),
		auctionId,
		customerId: "cust_1",
		amount: 10000,
		isWinning: true,
		isAutoBid: false,
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<AuctionController> = {},
): AuctionController {
	return {
		createAuction: vi.fn().mockResolvedValue(makeAuction()),
		updateAuction: vi.fn().mockResolvedValue(null),
		getAuction: vi.fn().mockResolvedValue(null),
		listAuctions: vi.fn().mockResolvedValue([]),
		deleteAuction: vi.fn().mockResolvedValue(false),
		publishAuction: vi.fn().mockResolvedValue(null),
		cancelAuction: vi.fn().mockResolvedValue(null),
		closeAuction: vi.fn().mockResolvedValue(null),
		placeBid: vi.fn().mockResolvedValue({
			bid: makeBid("auction_1"),
			auction: makeAuction(),
			outbidPreviousHighest: false,
		}),
		getBid: vi.fn().mockResolvedValue(null),
		listBids: vi.fn().mockResolvedValue([]),
		getHighestBid: vi.fn().mockResolvedValue(null),
		getBidsByCustomer: vi.fn().mockResolvedValue([]),
		buyNow: vi.fn().mockResolvedValue(makeAuction()),
		watchAuction: vi.fn().mockResolvedValue({
			id: "w1",
			auctionId: "a1",
			customerId: "c1",
			createdAt: new Date(),
		}),
		unwatchAuction: vi.fn().mockResolvedValue(false),
		getWatchers: vi.fn().mockResolvedValue([]),
		isWatching: vi.fn().mockResolvedValue(false),
		getWatchedAuctions: vi.fn().mockResolvedValue([]),
		getAuctionSummary: vi.fn().mockResolvedValue({
			totalAuctions: 0,
			draft: 0,
			scheduled: 0,
			active: 0,
			ended: 0,
			sold: 0,
			cancelled: 0,
			totalBids: 0,
			totalRevenue: 0,
		} satisfies AuctionSummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: AuctionController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { auctions: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const summaryHandler = extractHandler(auctionSummary);
const cancelHandler = extractHandler(cancelAuction);
const closeHandler = extractHandler(closeAuction);
const createHandler = extractHandler(createAuction);
const deleteHandler = extractHandler(deleteAuction);
const getHandler = extractHandler(getAuction);
const listHandler = extractHandler(listAuctions);
const listBidsHandler = extractHandler(listBids);
const publishHandler = extractHandler(publishAuction);
const updateHandler = extractHandler(updateAuction);

// ── auctionSummary ────────────────────────────────────────────────────────────

describe("admin GET /auctions/summary", () => {
	it("returns zero-state summary when no auctions exist", async () => {
		const result = (await call(summaryHandler)) as { summary: AuctionSummary };
		expect(result.summary.totalAuctions).toBe(0);
		expect(result.summary.totalBids).toBe(0);
		expect(result.summary.totalRevenue).toBe(0);
	});

	it("returns live summary from controller", async () => {
		const summary: AuctionSummary = {
			totalAuctions: 10,
			draft: 2,
			scheduled: 1,
			active: 3,
			ended: 2,
			sold: 1,
			cancelled: 1,
			totalBids: 45,
			totalRevenue: 150000,
		};
		const ctrl = makeController({
			getAuctionSummary: vi.fn().mockResolvedValue(summary),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: AuctionSummary;
		};
		expect(result.summary.totalAuctions).toBe(10);
		expect(result.summary.active).toBe(3);
		expect(result.summary.totalRevenue).toBe(150000);
	});
});

// ── listAuctions ──────────────────────────────────────────────────────────────

describe("admin GET /auctions", () => {
	it("returns empty list when no auctions exist", async () => {
		const result = (await call(listHandler)) as { auctions: Auction[] };
		expect(result.auctions).toHaveLength(0);
	});

	it("returns all auctions from controller", async () => {
		const auctions = [
			makeAuction({ title: "Auction 1" }),
			makeAuction({ title: "Auction 2" }),
		];
		const ctrl = makeController({
			listAuctions: vi.fn().mockResolvedValue(auctions),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			auctions: Auction[];
		};
		expect(result.auctions).toHaveLength(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { status: "active" }, controller: ctrl });
		expect(ctrl.listAuctions).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});

	it("forwards type filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { type: "dutch" }, controller: ctrl });
		expect(ctrl.listAuctions).toHaveBeenCalledWith(
			expect.objectContaining({ type: "dutch" }),
		);
	});

	it("uses default take=20 when not specified", async () => {
		const ctrl = makeController();
		await call(listHandler, { controller: ctrl });
		expect(ctrl.listAuctions).toHaveBeenCalledWith(
			expect.objectContaining({ take: 20 }),
		);
	});
});

// ── createAuction ─────────────────────────────────────────────────────────────

describe("admin POST /auctions/create", () => {
	it("creates an english auction and returns it", async () => {
		const now = new Date();
		const auction = makeAuction({ type: "english", title: "Watch Auction" });
		const ctrl = makeController({
			createAuction: vi.fn().mockResolvedValue(auction),
		});
		const result = (await call(createHandler, {
			body: {
				title: "Watch Auction",
				productId: "prod_1",
				productName: "Omega Seamaster",
				type: "english",
				startingPrice: 10000,
				startsAt: now.toISOString(),
				endsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
			},
			controller: ctrl,
		})) as { auction: Auction };
		expect(result.auction.type).toBe("english");
		expect(result.auction.title).toBe("Watch Auction");
		expect(ctrl.createAuction).toHaveBeenCalledWith(
			expect.objectContaining({ title: "Watch Auction", type: "english" }),
		);
	});

	it("creates a dutch auction", async () => {
		const now = new Date();
		const auction = makeAuction({ type: "dutch" });
		const ctrl = makeController({
			createAuction: vi.fn().mockResolvedValue(auction),
		});
		const result = (await call(createHandler, {
			body: {
				title: "Dutch Auction",
				productId: "prod_2",
				productName: "Rolex",
				type: "dutch",
				startingPrice: 50000,
				priceDropAmount: 1000,
				priceDropIntervalMinutes: 30,
				startsAt: now.toISOString(),
				endsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
			},
			controller: ctrl,
		})) as { auction: Auction };
		expect(result.auction.type).toBe("dutch");
	});

	it("creates a sealed auction", async () => {
		const now = new Date();
		const auction = makeAuction({ type: "sealed" });
		const ctrl = makeController({
			createAuction: vi.fn().mockResolvedValue(auction),
		});
		const result = (await call(createHandler, {
			body: {
				title: "Sealed Bid",
				productId: "prod_3",
				productName: "Art Piece",
				type: "sealed",
				startingPrice: 5000,
				startsAt: now.toISOString(),
				endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
			},
			controller: ctrl,
		})) as { auction: Auction };
		expect(result.auction.type).toBe("sealed");
	});
});

// ── getAuction ────────────────────────────────────────────────────────────────

describe("admin GET /auctions/:id", () => {
	it("returns 404 when auction not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "nonexistent" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Auction not found");
	});

	it("returns auction with recent bids and watcher count", async () => {
		const auction = makeAuction({ id: "auction_1" });
		const bids = [
			makeBid("auction_1"),
			makeBid("auction_1", { customerId: "cust_2" }),
		];
		const ctrl = makeController({
			getAuction: vi.fn().mockResolvedValue(auction),
			listBids: vi.fn().mockResolvedValue(bids),
			getWatchers: vi.fn().mockResolvedValue([
				{
					id: "w1",
					auctionId: "auction_1",
					customerId: "cust_1",
					createdAt: new Date(),
				},
				{
					id: "w2",
					auctionId: "auction_1",
					customerId: "cust_2",
					createdAt: new Date(),
				},
				{
					id: "w3",
					auctionId: "auction_1",
					customerId: "cust_3",
					createdAt: new Date(),
				},
			]),
		});
		const result = (await call(getHandler, {
			params: { id: "auction_1" },
			controller: ctrl,
		})) as { auction: Auction; recentBids: Bid[]; watcherCount: number };
		expect(result.auction.id).toBe("auction_1");
		expect(result.recentBids).toHaveLength(2);
		expect(result.watcherCount).toBe(3);
	});

	it("calls listBids and getWatchers with the auction id", async () => {
		const auction = makeAuction({ id: "auction_2" });
		const ctrl = makeController({
			getAuction: vi.fn().mockResolvedValue(auction),
			listBids: vi.fn().mockResolvedValue([]),
			getWatchers: vi.fn().mockResolvedValue([]),
		});
		await call(getHandler, { params: { id: "auction_2" }, controller: ctrl });
		expect(ctrl.listBids).toHaveBeenCalledWith("auction_2", expect.anything());
		expect(ctrl.getWatchers).toHaveBeenCalledWith("auction_2");
	});
});

// ── updateAuction ─────────────────────────────────────────────────────────────

describe("admin PUT /auctions/:id/update", () => {
	it("returns 404 when auction not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { title: "New Title" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated auction on success", async () => {
		const updated = makeAuction({ id: "auction_1", title: "Updated Title" });
		const ctrl = makeController({
			updateAuction: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateHandler, {
			params: { id: "auction_1" },
			body: { title: "Updated Title" },
			controller: ctrl,
		})) as { auction: Auction };
		expect(result.auction.title).toBe("Updated Title");
		expect(ctrl.updateAuction).toHaveBeenCalledWith(
			"auction_1",
			expect.objectContaining({ title: "Updated Title" }),
		);
	});

	it("forwards price updates to controller", async () => {
		const updated = makeAuction({ startingPrice: 20000 });
		const ctrl = makeController({
			updateAuction: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateHandler, {
			params: { id: updated.id },
			body: { startingPrice: 20000 },
			controller: ctrl,
		})) as { auction: Auction };
		expect(result.auction.startingPrice).toBe(20000);
	});
});

// ── deleteAuction ─────────────────────────────────────────────────────────────

describe("admin DELETE /auctions/:id/delete", () => {
	it("returns 404 when auction not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "gone" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes auction and returns deleted=true", async () => {
		const ctrl = makeController({
			deleteAuction: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "auction_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.deleteAuction).toHaveBeenCalledWith("auction_1");
	});
});

// ── publishAuction ────────────────────────────────────────────────────────────

describe("admin POST /auctions/:id/publish", () => {
	it("returns 404 when auction not found", async () => {
		const result = (await call(publishHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("publishes auction and returns it", async () => {
		const auction = makeAuction({ id: "auction_1", status: "scheduled" });
		const ctrl = makeController({
			publishAuction: vi.fn().mockResolvedValue(auction),
		});
		const result = (await call(publishHandler, {
			params: { id: "auction_1" },
			controller: ctrl,
		})) as { auction: Auction };
		expect(result.auction.id).toBe("auction_1");
		expect(result.auction.status).toBe("scheduled");
		expect(ctrl.publishAuction).toHaveBeenCalledWith("auction_1");
	});
});

// ── cancelAuction ─────────────────────────────────────────────────────────────

describe("admin POST /auctions/:id/cancel", () => {
	it("returns 404 when auction not found", async () => {
		const result = (await call(cancelHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("cancels auction and returns it", async () => {
		const auction = makeAuction({ id: "auction_1", status: "cancelled" });
		const ctrl = makeController({
			cancelAuction: vi.fn().mockResolvedValue(auction),
		});
		const result = (await call(cancelHandler, {
			params: { id: "auction_1" },
			controller: ctrl,
		})) as { auction: Auction };
		expect(result.auction.status).toBe("cancelled");
		expect(ctrl.cancelAuction).toHaveBeenCalledWith("auction_1");
	});
});

// ── closeAuction ──────────────────────────────────────────────────────────────

describe("admin POST /auctions/:id/close", () => {
	it("returns 404 when auction not found", async () => {
		const result = (await call(closeHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("closes auction and returns it with ended status", async () => {
		const auction = makeAuction({ id: "auction_1", status: "ended" });
		const ctrl = makeController({
			closeAuction: vi.fn().mockResolvedValue(auction),
		});
		const result = (await call(closeHandler, {
			params: { id: "auction_1" },
			controller: ctrl,
		})) as { auction: Auction };
		expect(result.auction.status).toBe("ended");
		expect(ctrl.closeAuction).toHaveBeenCalledWith("auction_1");
	});

	it("closes auction and returns it with sold status when reserve met", async () => {
		const auction = makeAuction({
			id: "auction_2",
			status: "sold",
			finalPrice: 25000,
			winnerId: "cust_1",
		});
		const ctrl = makeController({
			closeAuction: vi.fn().mockResolvedValue(auction),
		});
		const result = (await call(closeHandler, {
			params: { id: "auction_2" },
			controller: ctrl,
		})) as { auction: Auction };
		expect(result.auction.status).toBe("sold");
		expect(result.auction.winnerId).toBe("cust_1");
	});
});

// ── listBids ──────────────────────────────────────────────────────────────────

describe("admin GET /auctions/:id/bids", () => {
	it("returns empty list when no bids exist", async () => {
		const result = (await call(listBidsHandler, {
			params: { id: "auction_1" },
		})) as { bids: Bid[] };
		expect(result.bids).toHaveLength(0);
	});

	it("returns bids for the auction", async () => {
		const bids = [
			makeBid("auction_1", { amount: 10000 }),
			makeBid("auction_1", { amount: 11000, customerId: "cust_2" }),
		];
		const ctrl = makeController({
			listBids: vi.fn().mockResolvedValue(bids),
		});
		const result = (await call(listBidsHandler, {
			params: { id: "auction_1" },
			controller: ctrl,
		})) as { bids: Bid[] };
		expect(result.bids).toHaveLength(2);
		expect(result.bids[1].amount).toBe(11000);
	});

	it("forwards take and skip query params to controller", async () => {
		const ctrl = makeController();
		await call(listBidsHandler, {
			params: { id: "auction_1" },
			query: { take: "10", skip: "20" },
			controller: ctrl,
		});
		expect(ctrl.listBids).toHaveBeenCalledWith(
			"auction_1",
			expect.objectContaining({ take: 10, skip: 20 }),
		);
	});

	it("uses default take=50 when not specified", async () => {
		const ctrl = makeController();
		await call(listBidsHandler, {
			params: { id: "auction_1" },
			controller: ctrl,
		});
		expect(ctrl.listBids).toHaveBeenCalledWith(
			"auction_1",
			expect.objectContaining({ take: 50 }),
		);
	});
});
