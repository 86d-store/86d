import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuctionController } from "../service-impl";

/**
 * Security regression tests for auctions endpoints.
 *
 * Focuses on:
 * - Status guards for update and delete operations
 * - Bid validation (minimum amounts, duplicate highest bidder, sealed auction)
 * - Reserve price enforcement on close
 * - Buy-now availability guard
 * - Cancel terminal-status guard
 * - Idempotent watch behaviour
 */

describe("auctions endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAuctionController>;

	const past = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
	const future = (hours: number) =>
		new Date(Date.now() + hours * 60 * 60 * 1000);

	function makeAuction(overrides?: Record<string, unknown>) {
		return {
			title: "Vintage Watch",
			productId: "prod_1",
			productName: "Omega Seamaster",
			type: "english" as const,
			startingPrice: 10_000,
			startsAt: past(1),
			endsAt: future(24),
			...overrides,
		};
	}

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAuctionController(mockData);
	});

	// ── status guards: updateAuction ──────────────────────────────────────

	describe("status guards: updateAuction", () => {
		it("allows update on draft auction", async () => {
			// draft is created by giving a future startsAt so status = 'scheduled',
			// then we directly test that scheduled is editable
			const auction = await controller.createAuction(
				makeAuction({ startsAt: future(2) }),
			);
			expect(auction.status).toBe("scheduled");

			const updated = await controller.updateAuction(auction.id, {
				title: "Updated Title",
			});
			expect(updated?.title).toBe("Updated Title");
		});

		it("rejects update on active auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			expect(auction.status).toBe("active");

			await expect(
				controller.updateAuction(auction.id, { title: "Hack" }),
			).rejects.toThrow('Cannot update an auction with status "active"');
		});

		it("rejects update on sold auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 25_000 }),
			);
			// Buy now to transition to sold
			await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_1",
			});

			await expect(
				controller.updateAuction(auction.id, { title: "Hack" }),
			).rejects.toThrow('Cannot update an auction with status "sold"');
		});

		it("rejects update on cancelled auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.cancelAuction(auction.id);

			await expect(
				controller.updateAuction(auction.id, { title: "Hack" }),
			).rejects.toThrow('Cannot update an auction with status "cancelled"');
		});
	});

	// ── status guards: deleteAuction ──────────────────────────────────────

	describe("status guards: deleteAuction", () => {
		it("rejects deleting an active auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			expect(auction.status).toBe("active");

			await expect(controller.deleteAuction(auction.id)).rejects.toThrow(
				"Cannot delete an active auction",
			);
		});

		it("rejects deleting a sold auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 25_000 }),
			);
			await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_1",
			});

			await expect(controller.deleteAuction(auction.id)).rejects.toThrow(
				"Cannot delete a sold auction",
			);
		});

		it("allows deleting a scheduled auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startsAt: future(2) }),
			);
			expect(auction.status).toBe("scheduled");

			const result = await controller.deleteAuction(auction.id);
			expect(result).toBe(true);

			const found = await controller.getAuction(auction.id);
			expect(found).toBeNull();
		});

		it("allows deleting a cancelled auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.cancelAuction(auction.id);

			const result = await controller.deleteAuction(auction.id);
			expect(result).toBe(true);
		});
	});

	// ── bid validation: minimum amount ────────────────────────────────────

	describe("bid validation: minimum amount enforcement", () => {
		it("rejects bid below starting price when no bids placed yet", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startingPrice: 10_000, bidIncrement: 1_000 }),
			);

			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_1",
					customerName: "Alice",
					amount: 9_999,
				}),
			).rejects.toThrow("Bid must be at least 10000");
		});

		it("accepts bid equal to starting price when no bids placed", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startingPrice: 10_000, bidIncrement: 1_000 }),
			);

			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				customerName: "Alice",
				amount: 10_000,
			});

			expect(result.bid.amount).toBe(10_000);
		});

		it("rejects bid below currentBid + increment after a bid exists", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startingPrice: 10_000, bidIncrement: 1_000 }),
			);

			// First bid
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				customerName: "Alice",
				amount: 10_000,
			});

			// Second bid below minimum (10000 + 1000 = 11000 required)
			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_2",
					customerName: "Bob",
					amount: 10_500,
				}),
			).rejects.toThrow("Bid must be at least 11000");
		});

		it("accepts bid at currentBid + increment", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startingPrice: 10_000, bidIncrement: 1_000 }),
			);

			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				customerName: "Alice",
				amount: 10_000,
			});

			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_2",
				customerName: "Bob",
				amount: 11_000,
			});

			expect(result.bid.amount).toBe(11_000);
		});
	});

	// ── bid validation: cannot bid if already highest bidder ──────────────

	describe("bid validation: cannot outbid yourself", () => {
		it("rejects bid when customer is already highest bidder", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startingPrice: 10_000, bidIncrement: 1_000 }),
			);

			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				customerName: "Alice",
				amount: 10_000,
			});

			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_1",
					customerName: "Alice",
					amount: 11_000,
				}),
			).rejects.toThrow("You are already the highest bidder");
		});
	});

	// ── sealed auction: one bid per customer ──────────────────────────────

	describe("sealed auction: one bid per customer", () => {
		it("rejects a second bid from the same customer in a sealed auction", async () => {
			const auction = await controller.createAuction({
				...makeAuction(),
				type: "sealed" as const,
			});

			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				customerName: "Alice",
				amount: 10_000,
			});

			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_1",
					customerName: "Alice",
					amount: 15_000,
				}),
			).rejects.toThrow("You have already placed a bid in this sealed auction");
		});

		it("allows different customers to each place one bid in a sealed auction", async () => {
			const auction = await controller.createAuction({
				...makeAuction(),
				type: "sealed" as const,
			});

			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				customerName: "Alice",
				amount: 10_000,
			});

			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_2",
				customerName: "Bob",
				amount: 12_000,
			});

			expect(result.bid.customerId).toBe("cust_2");
		});
	});

	// ── reserve price: not sold if reserve not met ────────────────────────

	describe("reserve price: not sold when reserve not met on close", () => {
		it("closes as 'ended' when bids exist but reserve not met", async () => {
			const auction = await controller.createAuction(
				makeAuction({
					startingPrice: 10_000,
					bidIncrement: 1_000,
					reservePrice: 50_000,
				}),
			);

			// Place a bid well below reserve
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				customerName: "Alice",
				amount: 10_000,
			});

			const closed = await controller.closeAuction(auction.id);
			expect(closed?.status).toBe("ended");
		});

		it("closes as 'sold' when reserve is met", async () => {
			const auction = await controller.createAuction(
				makeAuction({
					startingPrice: 10_000,
					bidIncrement: 1_000,
					reservePrice: 10_000,
				}),
			);

			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				customerName: "Alice",
				amount: 10_000,
			});

			const closed = await controller.closeAuction(auction.id);
			expect(closed?.status).toBe("sold");
		});

		it("closes as 'ended' when no bids placed regardless of reserve", async () => {
			const auction = await controller.createAuction(
				makeAuction({ reservePrice: 10_000 }),
			);

			const closed = await controller.closeAuction(auction.id);
			expect(closed?.status).toBe("ended");
		});
	});

	// ── buy-now: must be enabled and auction active ───────────────────────

	describe("buy-now availability guard", () => {
		it("rejects buy-now when buyNowPrice is 0 (disabled)", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 0 }),
			);

			await expect(
				controller.buyNow({
					auctionId: auction.id,
					customerId: "cust_1",
				}),
			).rejects.toThrow("Buy-it-now is not enabled for this auction");
		});

		it("rejects buy-now when auction is not active", async () => {
			const auction = await controller.createAuction(
				makeAuction({
					startsAt: future(2),
					buyNowPrice: 20_000,
				}),
			);
			expect(auction.status).toBe("scheduled");

			await expect(
				controller.buyNow({
					auctionId: auction.id,
					customerId: "cust_1",
				}),
			).rejects.toThrow("Auction is not active");
		});

		it("succeeds and transitions to sold when buy-now is enabled and auction is active", async () => {
			const auction = await controller.createAuction(
				makeAuction({
					startingPrice: 10_000,
					buyNowPrice: 25_000,
				}),
			);

			const sold = await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_1",
			});

			expect(sold.status).toBe("sold");
			expect(sold.finalPrice).toBe(25_000);
			expect(sold.winnerId).toBe("cust_1");
		});
	});

	// ── cancel: rejects sold/cancelled auctions ───────────────────────────

	describe("cancel: terminal status guard", () => {
		it("rejects cancelling a sold auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 25_000 }),
			);
			await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_1",
			});

			await expect(controller.cancelAuction(auction.id)).rejects.toThrow(
				'Cannot cancel an auction with status "sold"',
			);
		});

		it("rejects cancelling an already-cancelled auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.cancelAuction(auction.id);

			await expect(controller.cancelAuction(auction.id)).rejects.toThrow(
				'Cannot cancel an auction with status "cancelled"',
			);
		});

		it("allows cancelling an active auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			expect(auction.status).toBe("active");

			const cancelled = await controller.cancelAuction(auction.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("allows cancelling a scheduled auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startsAt: future(2) }),
			);
			expect(auction.status).toBe("scheduled");

			const cancelled = await controller.cancelAuction(auction.id);
			expect(cancelled?.status).toBe("cancelled");
		});
	});

	// ── watch idempotency ─────────────────────────────────────────────────

	describe("watch idempotency", () => {
		it("watching the same auction twice returns the same watch record", async () => {
			const auction = await controller.createAuction(makeAuction());

			const w1 = await controller.watchAuction(auction.id, "cust_1");
			const w2 = await controller.watchAuction(auction.id, "cust_1");

			expect(w1.id).toBe(w2.id);
		});

		it("only one watch record exists after two watch calls", async () => {
			const auction = await controller.createAuction(makeAuction());

			await controller.watchAuction(auction.id, "cust_1");
			await controller.watchAuction(auction.id, "cust_1");

			const watchers = await controller.getWatchers(auction.id);
			expect(watchers).toHaveLength(1);
		});

		it("isWatching reflects current state correctly", async () => {
			const auction = await controller.createAuction(makeAuction());

			const beforeWatch = await controller.isWatching(auction.id, "cust_1");
			expect(beforeWatch).toBe(false);

			await controller.watchAuction(auction.id, "cust_1");
			const afterWatch = await controller.isWatching(auction.id, "cust_1");
			expect(afterWatch).toBe(true);

			await controller.unwatchAuction(auction.id, "cust_1");
			const afterUnwatch = await controller.isWatching(auction.id, "cust_1");
			expect(afterUnwatch).toBe(false);
		});
	});
});
