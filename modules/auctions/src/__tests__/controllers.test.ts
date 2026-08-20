import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuctionController } from "../service-impl";

/**
 * Controller-level edge-case tests for auctions.
 * Complements service-impl.test.ts by focusing on boundary conditions,
 * reserve-price logic, anti-sniping thresholds, status transitions,
 * and cross-concern isolation.
 */

const futureDate = (hours: number) =>
	new Date(Date.now() + hours * 60 * 60 * 1000);
const pastDate = (hours: number) =>
	new Date(Date.now() - hours * 60 * 60 * 1000);

const makeAuction = (overrides?: Record<string, unknown>) => ({
	title: "Vintage Watch",
	productId: "prod_1",
	productName: "Omega Seamaster",
	type: "english" as const,
	startingPrice: 10000,
	startsAt: pastDate(1),
	endsAt: futureDate(24),
	...overrides,
});

describe("auctions controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAuctionController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAuctionController(mockData);
	});

	// ==================== Bidding edge cases ====================

	describe("bidding boundary conditions", () => {
		it("rejects bid one cent below startingPrice", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startingPrice: 5000 }),
			);
			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_1",
					amount: 4999,
				}),
			).rejects.toThrow("Bid must be at least");
		});

		it("rejects second bid one cent below increment threshold", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startingPrice: 10000, bidIncrement: 500 }),
			);
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_2",
					amount: 10499,
				}),
			).rejects.toThrow("Bid must be at least 10500");
		});

		it("accepts second bid exactly at minimum increment", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startingPrice: 10000, bidIncrement: 500 }),
			);
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_2",
				amount: 10500,
			});
			expect(result.bid.amount).toBe(10500);
			expect(result.auction.bidCount).toBe(2);
		});

		it("rejects bid on cancelled auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.cancelAuction(auction.id);
			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_1",
					amount: 10000,
				}),
			).rejects.toThrow("Auction is not active");
		});

		it("rejects bid on sold auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 50000 }),
			);
			await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_1",
			});
			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_2",
					amount: 10000,
				}),
			).rejects.toThrow("Auction is not active");
		});

		it("tracks bidCount across three bidders", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_2",
				amount: 10100,
			});
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_3",
				amount: 10200,
			});
			expect(result.auction.bidCount).toBe(3);
			expect(result.auction.highestBidderId).toBe("cust_3");
		});

		it("outbidPreviousHighest toggles across alternating bidders", async () => {
			const auction = await controller.createAuction(makeAuction());
			const r1 = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const r2 = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_2",
				amount: 10100,
			});
			const r3 = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10200,
			});
			expect(r1.outbidPreviousHighest).toBe(false);
			expect(r2.outbidPreviousHighest).toBe(true);
			expect(r3.outbidPreviousHighest).toBe(true);
		});

		it("maxAutoBid is persisted and retrievable", async () => {
			const auction = await controller.createAuction(makeAuction());
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
				maxAutoBid: 25000,
			});
			expect(result.bid.maxAutoBid).toBe(25000);
			expect(result.bid.isAutoBid).toBe(false);
			const fetched = await controller.getBid(result.bid.id);
			expect(fetched?.maxAutoBid).toBe(25000);
		});
	});

	// ==================== Reserve price edge cases ====================

	describe("reserve price logic", () => {
		it("closing with bid exactly at reserve marks sold", async () => {
			const auction = await controller.createAuction(
				makeAuction({ reservePrice: 10000 }),
			);
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const closed = await controller.closeAuction(auction.id);
			expect(closed?.status).toBe("sold");
			expect(closed?.finalPrice).toBe(10000);
			expect(closed?.winnerId).toBe("cust_1");
		});

		it("closing with bid one cent below reserve marks ended", async () => {
			const auction = await controller.createAuction(
				makeAuction({ reservePrice: 20000 }),
			);
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 19999,
			});
			const closed = await controller.closeAuction(auction.id);
			expect(closed?.status).toBe("ended");
			expect(closed?.winnerId).toBeUndefined();
		});

		it("re-closing an ended auction keeps it ended", async () => {
			const auction = await controller.createAuction(
				makeAuction({ reservePrice: 99999 }),
			);
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			await controller.closeAuction(auction.id);
			const reClosed = await controller.closeAuction(auction.id);
			expect(reClosed?.status).toBe("ended");
		});
	});

	// ==================== Anti-sniping edge cases ====================

	describe("anti-sniping thresholds", () => {
		it("uses custom antiSnipingMinutes for extension", async () => {
			const auction = await controller.createAuction(
				makeAuction({
					endsAt: new Date(Date.now() + 60_000),
					antiSnipingEnabled: true,
					antiSnipingMinutes: 10,
				}),
			);
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const remaining = result.auction.endsAt.getTime() - Date.now();
			expect(remaining).toBeGreaterThan(9 * 60_000);
		});

		it("successive snipe bids each push end time forward", async () => {
			const auction = await controller.createAuction(
				makeAuction({
					endsAt: new Date(Date.now() + 3 * 60_000),
					antiSnipingEnabled: true,
					antiSnipingMinutes: 5,
				}),
			);
			const first = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const second = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_2",
				amount: 10100,
			});
			expect(second.auction.endsAt.getTime()).toBeGreaterThanOrEqual(
				first.auction.endsAt.getTime(),
			);
		});
	});

	// ==================== Buy-now during bidding ====================

	describe("buy-now with existing bids", () => {
		it("buy-now succeeds when bids already exist", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 50000 }),
			);
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const result = await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_2",
			});
			expect(result.status).toBe("sold");
			expect(result.winnerId).toBe("cust_2");
			expect(result.finalPrice).toBe(50000);
		});

		it("buy-now sets currentBid to buyNowPrice", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 75000 }),
			);
			const result = await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_1",
			});
			expect(result.currentBid).toBe(75000);
		});

		it("cannot buy-now twice on same auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 50000 }),
			);
			await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_1",
			});
			await expect(
				controller.buyNow({ auctionId: auction.id, customerId: "cust_2" }),
			).rejects.toThrow("Auction is not active");
		});
	});

	// ==================== Watch list isolation ====================

	describe("watch list isolation", () => {
		it("watching does not affect bidCount or currentBid", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.watchAuction(auction.id, "cust_1");
			await controller.watchAuction(auction.id, "cust_2");
			const fetched = await controller.getAuction(auction.id);
			expect(fetched?.bidCount).toBe(0);
			expect(fetched?.currentBid).toBe(0);
		});

		it("unwatching does not remove bid records", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.watchAuction(auction.id, "cust_1");
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			await controller.unwatchAuction(auction.id, "cust_1");
			expect(await controller.listBids(auction.id)).toHaveLength(1);
		});

		it("watchers are isolated between auctions", async () => {
			const a1 = await controller.createAuction(makeAuction({ title: "A1" }));
			const a2 = await controller.createAuction(makeAuction({ title: "A2" }));
			await controller.watchAuction(a1.id, "cust_1");
			await controller.watchAuction(a2.id, "cust_2");
			expect(await controller.isWatching(a1.id, "cust_2")).toBe(false);
			expect(await controller.isWatching(a2.id, "cust_1")).toBe(false);
		});
	});

	// ==================== Delete protection ====================

	describe("delete protection", () => {
		it("allows deleting a cancelled auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.cancelAuction(auction.id);
			expect(await controller.deleteAuction(auction.id)).toBe(true);
			expect(await controller.getAuction(auction.id)).toBeNull();
		});

		it("allows deleting an ended auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.closeAuction(auction.id);
			expect(await controller.deleteAuction(auction.id)).toBe(true);
		});
	});

	// ==================== Status transitions ====================

	describe("status transition constraints", () => {
		it("cannot publish an active auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await expect(controller.publishAuction(auction.id)).rejects.toThrow(
				'Cannot publish an auction with status "active"',
			);
		});

		it("cannot publish a cancelled auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.cancelAuction(auction.id);
			await expect(controller.publishAuction(auction.id)).rejects.toThrow(
				'Cannot publish an auction with status "cancelled"',
			);
		});

		it("cannot publish an ended auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.closeAuction(auction.id);
			await expect(controller.publishAuction(auction.id)).rejects.toThrow(
				'Cannot publish an auction with status "ended"',
			);
		});

		it("cannot close a cancelled auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.cancelAuction(auction.id);
			await expect(controller.closeAuction(auction.id)).rejects.toThrow(
				'Cannot close an auction with status "cancelled"',
			);
		});

		it("cannot update a cancelled auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.cancelAuction(auction.id);
			await expect(
				controller.updateAuction(auction.id, { title: "Nope" }),
			).rejects.toThrow('Cannot update an auction with status "cancelled"');
		});

		it("cannot update a sold auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 50000 }),
			);
			await controller.buyNow({ auctionId: auction.id, customerId: "c1" });
			await expect(
				controller.updateAuction(auction.id, { title: "Nope" }),
			).rejects.toThrow('Cannot update an auction with status "sold"');
		});
	});

	// ==================== Dutch auction validation ====================

	describe("dutch auction validation", () => {
		it("rejects zero price drop amount", async () => {
			await expect(
				controller.createAuction(
					makeAuction({
						type: "dutch" as const,
						priceDropAmount: 0,
						priceDropIntervalMinutes: 60,
					}),
				),
			).rejects.toThrow("positive price drop amount");
		});

		it("rejects negative price drop interval", async () => {
			await expect(
				controller.createAuction(
					makeAuction({
						type: "dutch" as const,
						priceDropAmount: 1000,
						priceDropIntervalMinutes: -1,
					}),
				),
			).rejects.toThrow("positive price drop interval");
		});
	});

	// ==================== Summary accuracy ====================

	describe("summary across mixed lifecycle", () => {
		it("tallies revenue only from sold auctions", async () => {
			const a1 = await controller.createAuction(
				makeAuction({ buyNowPrice: 30000, title: "Sold" }),
			);
			await controller.buyNow({ auctionId: a1.id, customerId: "c1" });
			const a2 = await controller.createAuction(makeAuction({ title: "E" }));
			await controller.closeAuction(a2.id);
			const a3 = await controller.createAuction(makeAuction({ title: "C" }));
			await controller.cancelAuction(a3.id);
			await controller.createAuction(makeAuction({ title: "Active" }));

			const summary = await controller.getAuctionSummary();
			expect(summary.totalAuctions).toBe(4);
			expect(summary.sold).toBe(1);
			expect(summary.ended).toBe(1);
			expect(summary.cancelled).toBe(1);
			expect(summary.active).toBe(1);
			expect(summary.totalRevenue).toBe(30000);
		});
	});
});
