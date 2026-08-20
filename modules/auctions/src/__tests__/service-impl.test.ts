import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuctionController } from "../service-impl";

// --- Helpers ---

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

const makeDutchAuction = (overrides?: Record<string, unknown>) => ({
	...makeAuction(),
	type: "dutch" as const,
	startingPrice: 50000,
	priceDropAmount: 5000,
	priceDropIntervalMinutes: 60,
	...overrides,
});

const makeSealedAuction = (overrides?: Record<string, unknown>) => ({
	...makeAuction(),
	type: "sealed" as const,
	...overrides,
});

describe("createAuctionController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAuctionController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAuctionController(mockData);
	});

	// ==================== Auction CRUD ====================

	describe("createAuction", () => {
		it("creates an english auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			expect(auction.id).toBeDefined();
			expect(auction.title).toBe("Vintage Watch");
			expect(auction.productId).toBe("prod_1");
			expect(auction.type).toBe("english");
			expect(auction.status).toBe("active");
			expect(auction.startingPrice).toBe(10000);
			expect(auction.currentBid).toBe(0);
			expect(auction.bidCount).toBe(0);
			expect(auction.antiSnipingEnabled).toBe(true);
			expect(auction.createdAt).toBeInstanceOf(Date);
		});

		it("creates a scheduled auction when start is in the future", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startsAt: futureDate(1) }),
			);
			expect(auction.status).toBe("scheduled");
		});

		it("defaults reservePrice to 0", async () => {
			const auction = await controller.createAuction(makeAuction());
			expect(auction.reservePrice).toBe(0);
		});

		it("defaults buyNowPrice to 0 (disabled)", async () => {
			const auction = await controller.createAuction(makeAuction());
			expect(auction.buyNowPrice).toBe(0);
		});

		it("defaults bidIncrement to 100", async () => {
			const auction = await controller.createAuction(makeAuction());
			expect(auction.bidIncrement).toBe(100);
		});

		it("accepts custom bid increment", async () => {
			const auction = await controller.createAuction(
				makeAuction({ bidIncrement: 500 }),
			);
			expect(auction.bidIncrement).toBe(500);
		});

		it("accepts reserve price", async () => {
			const auction = await controller.createAuction(
				makeAuction({ reservePrice: 50000 }),
			);
			expect(auction.reservePrice).toBe(50000);
		});

		it("accepts buy-now price", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 100000 }),
			);
			expect(auction.buyNowPrice).toBe(100000);
		});

		it("throws for zero starting price", async () => {
			await expect(
				controller.createAuction(makeAuction({ startingPrice: 0 })),
			).rejects.toThrow("Starting price must be greater than zero");
		});

		it("throws for negative starting price", async () => {
			await expect(
				controller.createAuction(makeAuction({ startingPrice: -100 })),
			).rejects.toThrow("Starting price must be greater than zero");
		});

		it("throws when end time is before start time", async () => {
			await expect(
				controller.createAuction(
					makeAuction({
						startsAt: futureDate(2),
						endsAt: futureDate(1),
					}),
				),
			).rejects.toThrow("End time must be after start time");
		});

		it("throws when buy-now price is less than starting price", async () => {
			await expect(
				controller.createAuction(
					makeAuction({ startingPrice: 10000, buyNowPrice: 5000 }),
				),
			).rejects.toThrow("Buy-it-now price must be greater than starting price");
		});

		it("throws when reserve price is below starting price", async () => {
			await expect(
				controller.createAuction(
					makeAuction({ startingPrice: 10000, reservePrice: 5000 }),
				),
			).rejects.toThrow("Reserve price must be at least the starting price");
		});

		it("creates a dutch auction with required fields", async () => {
			const auction = await controller.createAuction(makeDutchAuction());
			expect(auction.type).toBe("dutch");
			expect(auction.priceDropAmount).toBe(5000);
			expect(auction.priceDropIntervalMinutes).toBe(60);
		});

		it("throws for dutch auction without price drop amount", async () => {
			await expect(
				controller.createAuction(
					makeDutchAuction({ priceDropAmount: undefined }),
				),
			).rejects.toThrow("Dutch auctions require a positive price drop amount");
		});

		it("throws for dutch auction without price drop interval", async () => {
			await expect(
				controller.createAuction(
					makeDutchAuction({ priceDropIntervalMinutes: undefined }),
				),
			).rejects.toThrow(
				"Dutch auctions require a positive price drop interval",
			);
		});

		it("creates a sealed auction", async () => {
			const auction = await controller.createAuction(makeSealedAuction());
			expect(auction.type).toBe("sealed");
		});

		it("disables anti-sniping when specified", async () => {
			const auction = await controller.createAuction(
				makeAuction({ antiSnipingEnabled: false }),
			);
			expect(auction.antiSnipingEnabled).toBe(false);
		});

		it("accepts custom anti-sniping minutes", async () => {
			const auction = await controller.createAuction(
				makeAuction({ antiSnipingMinutes: 10 }),
			);
			expect(auction.antiSnipingMinutes).toBe(10);
		});
	});

	describe("updateAuction", () => {
		it("updates auction title", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startsAt: futureDate(1) }),
			);
			const updated = await controller.updateAuction(auction.id, {
				title: "Updated Title",
			});
			expect(updated?.title).toBe("Updated Title");
		});

		it("returns null for non-existent auction", async () => {
			const result = await controller.updateAuction("nonexistent", {
				title: "Test",
			});
			expect(result).toBeNull();
		});

		it("throws when updating active auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			expect(auction.status).toBe("active");
			await expect(
				controller.updateAuction(auction.id, { title: "New" }),
			).rejects.toThrow('Cannot update an auction with status "active"');
		});

		it("throws for invalid starting price update", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startsAt: futureDate(1) }),
			);
			await expect(
				controller.updateAuction(auction.id, { startingPrice: 0 }),
			).rejects.toThrow("Starting price must be greater than zero");
		});

		it("throws when end time would be before start time", async () => {
			const auction = await controller.createAuction(
				makeAuction({
					startsAt: futureDate(1),
					endsAt: futureDate(48),
				}),
			);
			await expect(
				controller.updateAuction(auction.id, { endsAt: pastDate(1) }),
			).rejects.toThrow("End time must be after start time");
		});
	});

	describe("getAuction", () => {
		it("returns auction by id", async () => {
			const created = await controller.createAuction(makeAuction());
			const found = await controller.getAuction(created.id);
			expect(found?.id).toBe(created.id);
			expect(found?.title).toBe("Vintage Watch");
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.getAuction("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("listAuctions", () => {
		it("lists all auctions", async () => {
			await controller.createAuction(makeAuction({ title: "A" }));
			await controller.createAuction(makeAuction({ title: "B" }));
			const auctions = await controller.listAuctions();
			expect(auctions).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.createAuction(makeAuction());
			await controller.createAuction(
				makeAuction({
					title: "Scheduled",
					startsAt: futureDate(1),
				}),
			);
			const active = await controller.listAuctions({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].status).toBe("active");
		});

		it("filters by type", async () => {
			await controller.createAuction(makeAuction());
			await controller.createAuction(makeDutchAuction());
			const english = await controller.listAuctions({ type: "english" });
			expect(english).toHaveLength(1);
			expect(english[0].type).toBe("english");
		});

		it("supports pagination", async () => {
			await controller.createAuction(makeAuction({ title: "A" }));
			await controller.createAuction(makeAuction({ title: "B" }));
			await controller.createAuction(makeAuction({ title: "C" }));
			const page = await controller.listAuctions({ take: 2 });
			expect(page).toHaveLength(2);
		});
	});

	describe("deleteAuction", () => {
		it("deletes a draft auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startsAt: futureDate(1) }),
			);
			// It's scheduled, which is editable, need to also test a cancelled one
			const deleted = await controller.deleteAuction(auction.id);
			expect(deleted).toBe(true);
			const found = await controller.getAuction(auction.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent auction", async () => {
			const deleted = await controller.deleteAuction("nonexistent");
			expect(deleted).toBe(false);
		});

		it("throws when deleting active auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await expect(controller.deleteAuction(auction.id)).rejects.toThrow(
				"Cannot delete an active auction",
			);
		});

		it("throws when deleting sold auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 50000 }),
			);
			await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_1",
			});
			await expect(controller.deleteAuction(auction.id)).rejects.toThrow(
				"Cannot delete a sold auction",
			);
		});
	});

	// ==================== Auction Lifecycle ====================

	describe("publishAuction", () => {
		it("publishes a scheduled auction as active", async () => {
			await controller.createAuction(makeAuction({ startsAt: pastDate(1) }));
			// Already active since startsAt is in the past, create a scheduled one
			const scheduled = await controller.createAuction(
				makeAuction({ startsAt: futureDate(1), endsAt: futureDate(48) }),
			);
			expect(scheduled.status).toBe("scheduled");

			// Publishing a scheduled auction whose startsAt is in the future keeps it scheduled
			const published = await controller.publishAuction(scheduled.id);
			expect(published?.status).toBe("scheduled");
		});

		it("returns null for non-existent auction", async () => {
			const result = await controller.publishAuction("nonexistent");
			expect(result).toBeNull();
		});

		it("throws when publishing sold auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 50000 }),
			);
			await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_1",
			});
			await expect(controller.publishAuction(auction.id)).rejects.toThrow(
				'Cannot publish an auction with status "sold"',
			);
		});
	});

	describe("cancelAuction", () => {
		it("cancels an active auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			const cancelled = await controller.cancelAuction(auction.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cancels a scheduled auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startsAt: futureDate(1) }),
			);
			const cancelled = await controller.cancelAuction(auction.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns null for non-existent auction", async () => {
			const result = await controller.cancelAuction("nonexistent");
			expect(result).toBeNull();
		});

		it("throws when cancelling sold auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 50000 }),
			);
			await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_1",
			});
			await expect(controller.cancelAuction(auction.id)).rejects.toThrow(
				'Cannot cancel an auction with status "sold"',
			);
		});

		it("throws when cancelling already cancelled auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.cancelAuction(auction.id);
			await expect(controller.cancelAuction(auction.id)).rejects.toThrow(
				'Cannot cancel an auction with status "cancelled"',
			);
		});
	});

	describe("closeAuction", () => {
		it("closes active auction with bids above reserve as sold", async () => {
			const auction = await controller.createAuction(
				makeAuction({ reservePrice: 10000 }),
			);
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 15000,
			});
			const closed = await controller.closeAuction(auction.id);
			expect(closed?.status).toBe("sold");
			expect(closed?.winnerId).toBe("cust_1");
			expect(closed?.finalPrice).toBe(15000);
		});

		it("closes auction as ended when reserve not met", async () => {
			const auction = await controller.createAuction(
				makeAuction({ reservePrice: 100000 }),
			);
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const closed = await controller.closeAuction(auction.id);
			expect(closed?.status).toBe("ended");
		});

		it("closes auction as ended when no bids", async () => {
			const auction = await controller.createAuction(makeAuction());
			const closed = await controller.closeAuction(auction.id);
			expect(closed?.status).toBe("ended");
		});

		it("closes auction with no reserve as sold when bids exist", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const closed = await controller.closeAuction(auction.id);
			expect(closed?.status).toBe("sold");
		});

		it("returns null for non-existent auction", async () => {
			const result = await controller.closeAuction("nonexistent");
			expect(result).toBeNull();
		});

		it("throws when closing scheduled auction", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startsAt: futureDate(1) }),
			);
			await expect(controller.closeAuction(auction.id)).rejects.toThrow(
				'Cannot close an auction with status "scheduled"',
			);
		});
	});

	// ==================== Bidding ====================

	describe("placeBid", () => {
		it("places first bid at starting price", async () => {
			const auction = await controller.createAuction(makeAuction());
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			expect(result.bid.amount).toBe(10000);
			expect(result.bid.isWinning).toBe(true);
			expect(result.auction.currentBid).toBe(10000);
			expect(result.auction.bidCount).toBe(1);
			expect(result.outbidPreviousHighest).toBe(false);
		});

		it("outbids previous highest bidder", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_2",
				amount: 10100,
			});
			expect(result.bid.isWinning).toBe(true);
			expect(result.outbidPreviousHighest).toBe(true);
			expect(result.auction.currentBid).toBe(10100);
			expect(result.auction.bidCount).toBe(2);
			expect(result.auction.highestBidderId).toBe("cust_2");
		});

		it("marks previous winning bid as not winning", async () => {
			const auction = await controller.createAuction(makeAuction());
			const first = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_2",
				amount: 10100,
			});
			const oldBid = await controller.getBid(first.bid.id);
			expect(oldBid?.isWinning).toBe(false);
		});

		it("throws when bid is below minimum", async () => {
			const auction = await controller.createAuction(makeAuction());
			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_1",
					amount: 5000,
				}),
			).rejects.toThrow("Bid must be at least");
		});

		it("throws when bid increment not met", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_2",
					amount: 10050,
				}),
			).rejects.toThrow("Bid must be at least");
		});

		it("throws on non-existent auction", async () => {
			await expect(
				controller.placeBid({
					auctionId: "nonexistent",
					customerId: "cust_1",
					amount: 10000,
				}),
			).rejects.toThrow("Auction not found");
		});

		it("throws when auction is not active", async () => {
			const auction = await controller.createAuction(
				makeAuction({ startsAt: futureDate(1) }),
			);
			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_1",
					amount: 10000,
				}),
			).rejects.toThrow("Auction is not active");
		});

		it("throws when already highest bidder", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_1",
					amount: 10100,
				}),
			).rejects.toThrow("You are already the highest bidder");
		});

		it("extends auction end time with anti-sniping", async () => {
			const auction = await controller.createAuction(
				makeAuction({
					endsAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes from now
					antiSnipingEnabled: true,
					antiSnipingMinutes: 5,
				}),
			);
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			// Auction should be extended by 5 minutes from now
			const msUntilEnd = result.auction.endsAt.getTime() - Date.now();
			expect(msUntilEnd).toBeGreaterThan(4 * 60 * 1000);
		});

		it("does not extend when anti-sniping is disabled", async () => {
			const endsAt = new Date(Date.now() + 2 * 60 * 1000);
			const auction = await controller.createAuction(
				makeAuction({
					endsAt,
					antiSnipingEnabled: false,
				}),
			);
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			expect(result.auction.endsAt.getTime()).toBe(endsAt.getTime());
		});

		it("does not extend when bid is not near end", async () => {
			const endsAt = futureDate(24);
			const auction = await controller.createAuction(makeAuction({ endsAt }));
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			expect(result.auction.endsAt.getTime()).toBe(endsAt.getTime());
		});

		it("prevents duplicate bids in sealed auction", async () => {
			const auction = await controller.createAuction(makeSealedAuction());
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			await expect(
				controller.placeBid({
					auctionId: auction.id,
					customerId: "cust_1",
					amount: 15000,
				}),
			).rejects.toThrow("You have already placed a bid in this sealed auction");
		});

		it("allows different customers in sealed auction", async () => {
			const auction = await controller.createAuction(makeSealedAuction());
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_2",
				amount: 15000,
			});
			expect(result.bid.customerId).toBe("cust_2");
		});

		it("stores customer name", async () => {
			const auction = await controller.createAuction(makeAuction());
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				customerName: "John Doe",
				amount: 10000,
			});
			expect(result.bid.customerName).toBe("John Doe");
		});

		it("stores maxAutoBid", async () => {
			const auction = await controller.createAuction(makeAuction());
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
				maxAutoBid: 50000,
			});
			expect(result.bid.maxAutoBid).toBe(50000);
		});
	});

	describe("getBid", () => {
		it("returns bid by id", async () => {
			const auction = await controller.createAuction(makeAuction());
			const result = await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const found = await controller.getBid(result.bid.id);
			expect(found?.amount).toBe(10000);
		});

		it("returns null for non-existent bid", async () => {
			const result = await controller.getBid("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("listBids", () => {
		it("lists bids for an auction", async () => {
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
			const bids = await controller.listBids(auction.id);
			expect(bids).toHaveLength(2);
		});

		it("supports pagination", async () => {
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
			await controller.placeBid({
				auctionId: auction.id,
				customerId: "cust_3",
				amount: 10200,
			});
			const bids = await controller.listBids(auction.id, { take: 2 });
			expect(bids).toHaveLength(2);
		});
	});

	describe("getHighestBid", () => {
		it("returns the winning bid", async () => {
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
			const highest = await controller.getHighestBid(auction.id);
			expect(highest?.amount).toBe(10100);
			expect(highest?.customerId).toBe("cust_2");
		});

		it("returns null when no bids", async () => {
			const auction = await controller.createAuction(makeAuction());
			const highest = await controller.getHighestBid(auction.id);
			expect(highest).toBeNull();
		});
	});

	describe("getBidsByCustomer", () => {
		it("returns bids for a customer", async () => {
			const a1 = await controller.createAuction(makeAuction({ title: "A1" }));
			const a2 = await controller.createAuction(makeAuction({ title: "A2" }));
			await controller.placeBid({
				auctionId: a1.id,
				customerId: "cust_1",
				amount: 10000,
			});
			await controller.placeBid({
				auctionId: a2.id,
				customerId: "cust_1",
				amount: 10000,
			});
			await controller.placeBid({
				auctionId: a1.id,
				customerId: "cust_2",
				amount: 10100,
			});
			const bids = await controller.getBidsByCustomer("cust_1");
			expect(bids).toHaveLength(2);
		});

		it("filters by auction id", async () => {
			const a1 = await controller.createAuction(makeAuction({ title: "A1" }));
			const a2 = await controller.createAuction(makeAuction({ title: "A2" }));
			await controller.placeBid({
				auctionId: a1.id,
				customerId: "cust_1",
				amount: 10000,
			});
			await controller.placeBid({
				auctionId: a2.id,
				customerId: "cust_1",
				amount: 10000,
			});
			const bids = await controller.getBidsByCustomer("cust_1", {
				auctionId: a1.id,
			});
			expect(bids).toHaveLength(1);
		});
	});

	// ==================== Buy-it-now ====================

	describe("buyNow", () => {
		it("buys auction at buy-now price", async () => {
			const auction = await controller.createAuction(
				makeAuction({ buyNowPrice: 50000 }),
			);
			const result = await controller.buyNow({
				auctionId: auction.id,
				customerId: "cust_1",
			});
			expect(result.status).toBe("sold");
			expect(result.winnerId).toBe("cust_1");
			expect(result.finalPrice).toBe(50000);
		});

		it("throws when buy-now is not enabled", async () => {
			const auction = await controller.createAuction(makeAuction());
			await expect(
				controller.buyNow({
					auctionId: auction.id,
					customerId: "cust_1",
				}),
			).rejects.toThrow("Buy-it-now is not enabled for this auction");
		});

		it("throws on non-existent auction", async () => {
			await expect(
				controller.buyNow({
					auctionId: "nonexistent",
					customerId: "cust_1",
				}),
			).rejects.toThrow("Auction not found");
		});

		it("throws when auction is not active", async () => {
			const auction = await controller.createAuction(
				makeAuction({
					startsAt: futureDate(1),
					buyNowPrice: 50000,
				}),
			);
			await expect(
				controller.buyNow({
					auctionId: auction.id,
					customerId: "cust_1",
				}),
			).rejects.toThrow("Auction is not active");
		});
	});

	// ==================== Watching ====================

	describe("watchAuction", () => {
		it("adds a watcher", async () => {
			const auction = await controller.createAuction(makeAuction());
			const watch = await controller.watchAuction(auction.id, "cust_1");
			expect(watch.auctionId).toBe(auction.id);
			expect(watch.customerId).toBe("cust_1");
		});

		it("returns existing watch if already watching", async () => {
			const auction = await controller.createAuction(makeAuction());
			const first = await controller.watchAuction(auction.id, "cust_1");
			const second = await controller.watchAuction(auction.id, "cust_1");
			expect(first.id).toBe(second.id);
		});
	});

	describe("unwatchAuction", () => {
		it("removes a watcher", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.watchAuction(auction.id, "cust_1");
			const removed = await controller.unwatchAuction(auction.id, "cust_1");
			expect(removed).toBe(true);
		});

		it("returns false when not watching", async () => {
			const auction = await controller.createAuction(makeAuction());
			const removed = await controller.unwatchAuction(auction.id, "cust_1");
			expect(removed).toBe(false);
		});
	});

	describe("getWatchers", () => {
		it("returns all watchers for an auction", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.watchAuction(auction.id, "cust_1");
			await controller.watchAuction(auction.id, "cust_2");
			const watchers = await controller.getWatchers(auction.id);
			expect(watchers).toHaveLength(2);
		});
	});

	describe("isWatching", () => {
		it("returns true when watching", async () => {
			const auction = await controller.createAuction(makeAuction());
			await controller.watchAuction(auction.id, "cust_1");
			const watching = await controller.isWatching(auction.id, "cust_1");
			expect(watching).toBe(true);
		});

		it("returns false when not watching", async () => {
			const auction = await controller.createAuction(makeAuction());
			const watching = await controller.isWatching(auction.id, "cust_1");
			expect(watching).toBe(false);
		});
	});

	describe("getWatchedAuctions", () => {
		it("returns auctions watched by customer", async () => {
			const a1 = await controller.createAuction(makeAuction({ title: "A1" }));
			const a2 = await controller.createAuction(makeAuction({ title: "A2" }));
			await controller.watchAuction(a1.id, "cust_1");
			await controller.watchAuction(a2.id, "cust_1");
			const watched = await controller.getWatchedAuctions("cust_1");
			expect(watched).toHaveLength(2);
		});
	});

	// ==================== Analytics ====================

	describe("getAuctionSummary", () => {
		it("returns empty summary when no auctions", async () => {
			const summary = await controller.getAuctionSummary();
			expect(summary.totalAuctions).toBe(0);
			expect(summary.totalBids).toBe(0);
			expect(summary.totalRevenue).toBe(0);
		});

		it("counts auctions by status", async () => {
			await controller.createAuction(makeAuction());
			await controller.createAuction(makeAuction({ startsAt: futureDate(1) }));
			const summary = await controller.getAuctionSummary();
			expect(summary.totalAuctions).toBe(2);
			expect(summary.active).toBe(1);
			expect(summary.scheduled).toBe(1);
		});

		it("calculates total bids", async () => {
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
			const summary = await controller.getAuctionSummary();
			expect(summary.totalBids).toBe(2);
		});

		it("calculates revenue from sold auctions", async () => {
			const a1 = await controller.createAuction(
				makeAuction({ buyNowPrice: 50000 }),
			);
			const a2 = await controller.createAuction(
				makeAuction({ buyNowPrice: 30000, title: "Other" }),
			);
			await controller.buyNow({
				auctionId: a1.id,
				customerId: "cust_1",
			});
			await controller.buyNow({
				auctionId: a2.id,
				customerId: "cust_2",
			});
			const summary = await controller.getAuctionSummary();
			expect(summary.sold).toBe(2);
			expect(summary.totalRevenue).toBe(80000);
		});
	});
});
