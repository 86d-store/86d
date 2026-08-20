import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Auction,
	AuctionController,
	AuctionSummary,
	AuctionWatch,
	Bid,
} from "./service";

const EDITABLE_STATUSES = new Set(["draft", "scheduled"]);
const TERMINAL_STATUSES = new Set(["sold", "cancelled"]);

export function createAuctionController(
	data: ModuleDataService,
): AuctionController {
	// --- Helpers ---

	async function updateAuctionRecord(
		id: string,
		updates: Record<string, unknown>,
	): Promise<Auction | null> {
		const existing = await data.get("auction", id);
		if (!existing) return null;

		const updated = {
			...(existing as unknown as Auction),
			...updates,
			updatedAt: new Date(),
		};
		await data.upsert("auction", id, updated as Record<string, unknown>);
		return updated;
	}

	async function markPreviousBidsAsLosing(auctionId: string): Promise<void> {
		const allBids = await data.findMany("bid", {
			where: { auctionId, isWinning: true },
		});
		for (const bid of allBids) {
			const b = bid as unknown as Bid;
			await data.upsert("bid", b.id, { ...b, isWinning: false } as Record<
				string,
				unknown
			>);
		}
	}

	return {
		// ==================== Auction CRUD ====================

		async createAuction(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			if (params.startingPrice <= 0) {
				throw new Error("Starting price must be greater than zero");
			}
			if (params.endsAt <= params.startsAt) {
				throw new Error("End time must be after start time");
			}
			if (
				params.buyNowPrice !== undefined &&
				params.buyNowPrice > 0 &&
				params.buyNowPrice <= params.startingPrice
			) {
				throw new Error("Buy-it-now price must be greater than starting price");
			}
			if (
				params.reservePrice !== undefined &&
				params.reservePrice > 0 &&
				params.reservePrice < params.startingPrice
			) {
				throw new Error("Reserve price must be at least the starting price");
			}
			if (params.type === "dutch") {
				if (!params.priceDropAmount || params.priceDropAmount <= 0) {
					throw new Error(
						"Dutch auctions require a positive price drop amount",
					);
				}
				if (
					!params.priceDropIntervalMinutes ||
					params.priceDropIntervalMinutes <= 0
				) {
					throw new Error(
						"Dutch auctions require a positive price drop interval",
					);
				}
			}

			const status = params.startsAt <= now ? "active" : "scheduled";

			const auction: Auction = {
				id,
				title: params.title,
				description: params.description,
				productId: params.productId,
				productName: params.productName,
				imageUrl: params.imageUrl,
				type: params.type,
				status,
				startingPrice: params.startingPrice,
				reservePrice: params.reservePrice ?? 0,
				buyNowPrice: params.buyNowPrice ?? 0,
				bidIncrement: params.bidIncrement ?? 100,
				currentBid: 0,
				bidCount: 0,
				startsAt: params.startsAt,
				endsAt: params.endsAt,
				antiSnipingEnabled: params.antiSnipingEnabled ?? true,
				antiSnipingMinutes: params.antiSnipingMinutes ?? 5,
				priceDropAmount: params.priceDropAmount,
				priceDropIntervalMinutes: params.priceDropIntervalMinutes,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("auction", id, auction as Record<string, unknown>);
			return auction;
		},

		async updateAuction(id, params) {
			const existing = await data.get("auction", id);
			if (!existing) return null;

			const auction = existing as unknown as Auction;
			if (!EDITABLE_STATUSES.has(auction.status)) {
				throw new Error(
					`Cannot update an auction with status "${auction.status}"`,
				);
			}

			if (params.startingPrice !== undefined && params.startingPrice <= 0) {
				throw new Error("Starting price must be greater than zero");
			}

			const startsAt = params.startsAt ?? auction.startsAt;
			const endsAt = params.endsAt ?? auction.endsAt;
			if (endsAt <= startsAt) {
				throw new Error("End time must be after start time");
			}

			const updated = {
				...auction,
				...Object.fromEntries(
					Object.entries(params).filter(([, v]) => v !== undefined),
				),
				updatedAt: new Date(),
			};

			await data.upsert("auction", id, updated as Record<string, unknown>);
			return updated as Auction;
		},

		async getAuction(id) {
			const raw = await data.get("auction", id);
			if (!raw) return null;
			return raw as unknown as Auction;
		},

		async listAuctions(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.type) where.type = params.type;

			const raw = await data.findMany("auction", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as Auction[];
		},

		async deleteAuction(id) {
			const existing = await data.get("auction", id);
			if (!existing) return false;

			const auction = existing as unknown as Auction;
			if (auction.status === "active") {
				throw new Error("Cannot delete an active auction");
			}
			if (auction.status === "sold") {
				throw new Error("Cannot delete a sold auction");
			}

			await data.delete("auction", id);
			return true;
		},

		// ==================== Auction lifecycle ====================

		async publishAuction(id) {
			const existing = await data.get("auction", id);
			if (!existing) return null;
			const auction = existing as unknown as Auction;

			if (!EDITABLE_STATUSES.has(auction.status)) {
				throw new Error(
					`Cannot publish an auction with status "${auction.status}"`,
				);
			}

			const now = new Date();
			const newStatus = auction.startsAt <= now ? "active" : "scheduled";

			return updateAuctionRecord(id, { status: newStatus });
		},

		async cancelAuction(id) {
			const existing = await data.get("auction", id);
			if (!existing) return null;
			const auction = existing as unknown as Auction;

			if (TERMINAL_STATUSES.has(auction.status)) {
				throw new Error(
					`Cannot cancel an auction with status "${auction.status}"`,
				);
			}

			return updateAuctionRecord(id, { status: "cancelled" });
		},

		async closeAuction(id) {
			const existing = await data.get("auction", id);
			if (!existing) return null;
			const auction = existing as unknown as Auction;

			if (auction.status !== "active" && auction.status !== "ended") {
				throw new Error(
					`Cannot close an auction with status "${auction.status}"`,
				);
			}

			const reserveMet =
				auction.reservePrice === 0 ||
				auction.currentBid >= auction.reservePrice;

			if (auction.bidCount > 0 && reserveMet) {
				return updateAuctionRecord(id, {
					status: "sold",
					winnerId: auction.highestBidderId,
					finalPrice: auction.currentBid,
				});
			}

			return updateAuctionRecord(id, { status: "ended" });
		},

		// ==================== Bidding ====================

		async placeBid(params) {
			const existing = await data.get("auction", params.auctionId);
			if (!existing) {
				throw new Error("Auction not found");
			}
			const auction = existing as unknown as Auction;

			if (auction.status !== "active") {
				throw new Error("Auction is not active");
			}

			const now = new Date();
			if (now > auction.endsAt) {
				throw new Error("Auction has ended");
			}

			if (auction.type === "sealed") {
				// Sealed auctions: allow one bid per customer
				const existingBids = await data.findMany("bid", {
					where: {
						auctionId: params.auctionId,
						customerId: params.customerId,
					},
				});
				if ((existingBids as unknown[]).length > 0) {
					throw new Error(
						"You have already placed a bid in this sealed auction",
					);
				}
			}

			const minimumBid =
				auction.currentBid > 0
					? auction.currentBid + auction.bidIncrement
					: auction.startingPrice;

			if (params.amount < minimumBid) {
				throw new Error(
					`Bid must be at least ${minimumBid} (current: ${auction.currentBid}, increment: ${auction.bidIncrement})`,
				);
			}

			if (auction.highestBidderId === params.customerId) {
				throw new Error("You are already the highest bidder");
			}

			const outbidPreviousHighest = auction.bidCount > 0;

			// Mark previous winning bids as not winning
			await markPreviousBidsAsLosing(params.auctionId);

			const bidId = crypto.randomUUID();
			const bid: Bid = {
				id: bidId,
				auctionId: params.auctionId,
				customerId: params.customerId,
				customerName: params.customerName,
				amount: params.amount,
				maxAutoBid: params.maxAutoBid,
				isWinning: true,
				isAutoBid: false,
				createdAt: now,
			};

			await data.upsert("bid", bidId, bid as Record<string, unknown>);

			// Anti-sniping: extend auction if bid comes in near the end
			let newEndsAt = auction.endsAt;
			if (auction.antiSnipingEnabled) {
				const msUntilEnd = auction.endsAt.getTime() - now.getTime();
				const antiSnipingMs = auction.antiSnipingMinutes * 60 * 1000;
				if (msUntilEnd < antiSnipingMs) {
					newEndsAt = new Date(now.getTime() + antiSnipingMs);
				}
			}

			const updatedAuction = await updateAuctionRecord(params.auctionId, {
				currentBid: params.amount,
				bidCount: auction.bidCount + 1,
				highestBidderId: params.customerId,
				endsAt: newEndsAt,
			});

			return {
				bid,
				auction: updatedAuction as Auction,
				outbidPreviousHighest,
			};
		},

		async getBid(id) {
			const raw = await data.get("bid", id);
			if (!raw) return null;
			return raw as unknown as Bid;
		},

		async listBids(auctionId, params) {
			const raw = await data.findMany("bid", {
				where: { auctionId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as Bid[];
		},

		async getHighestBid(auctionId) {
			const bids = await data.findMany("bid", {
				where: { auctionId, isWinning: true },
				take: 1,
			});
			const result = bids as unknown as Bid[];
			return result.length > 0 ? result[0] : null;
		},

		async getBidsByCustomer(customerId, params) {
			const where: Record<string, unknown> = { customerId };
			if (params?.auctionId) where.auctionId = params.auctionId;

			const raw = await data.findMany("bid", {
				where,
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as Bid[];
		},

		// ==================== Buy-it-now ====================

		async buyNow(params) {
			const existing = await data.get("auction", params.auctionId);
			if (!existing) {
				throw new Error("Auction not found");
			}
			const auction = existing as unknown as Auction;

			if (auction.status !== "active") {
				throw new Error("Auction is not active");
			}
			if (auction.buyNowPrice <= 0) {
				throw new Error("Buy-it-now is not enabled for this auction");
			}

			const now = new Date();
			if (now > auction.endsAt) {
				throw new Error("Auction has ended");
			}

			const updated = await updateAuctionRecord(params.auctionId, {
				status: "sold",
				winnerId: params.customerId,
				finalPrice: auction.buyNowPrice,
				currentBid: auction.buyNowPrice,
			});

			return updated as Auction;
		},

		// ==================== Watching ====================

		async watchAuction(auctionId, customerId) {
			const existing = await data.findMany("auctionWatch", {
				where: { auctionId, customerId },
			});
			if ((existing as unknown[]).length > 0) {
				return (existing as unknown as AuctionWatch[])[0];
			}

			const id = crypto.randomUUID();
			const watch: AuctionWatch = {
				id,
				auctionId,
				customerId,
				createdAt: new Date(),
			};

			await data.upsert("auctionWatch", id, watch as Record<string, unknown>);
			return watch;
		},

		async unwatchAuction(auctionId, customerId) {
			const existing = await data.findMany("auctionWatch", {
				where: { auctionId, customerId },
			});
			const watches = existing as unknown as AuctionWatch[];
			if (watches.length === 0) return false;

			await data.delete("auctionWatch", watches[0].id);
			return true;
		},

		async getWatchers(auctionId) {
			const raw = await data.findMany("auctionWatch", {
				where: { auctionId },
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as AuctionWatch[];
		},

		async isWatching(auctionId, customerId) {
			const existing = await data.findMany("auctionWatch", {
				where: { auctionId, customerId },
			});
			return (existing as unknown[]).length > 0;
		},

		async getWatchedAuctions(customerId) {
			const raw = await data.findMany("auctionWatch", {
				where: { customerId },
				orderBy: { createdAt: "desc" },
			});
			return raw as unknown as AuctionWatch[];
		},

		// ==================== Analytics ====================

		async getAuctionSummary() {
			const all = await data.findMany("auction", {});
			const auctions = all as unknown as Auction[];

			const summary: AuctionSummary = {
				totalAuctions: auctions.length,
				draft: 0,
				scheduled: 0,
				active: 0,
				ended: 0,
				sold: 0,
				cancelled: 0,
				totalBids: 0,
				totalRevenue: 0,
			};

			for (const auction of auctions) {
				switch (auction.status) {
					case "draft":
						summary.draft++;
						break;
					case "scheduled":
						summary.scheduled++;
						break;
					case "active":
						summary.active++;
						break;
					case "ended":
						summary.ended++;
						break;
					case "sold":
						summary.sold++;
						summary.totalRevenue += auction.finalPrice ?? 0;
						break;
					case "cancelled":
						summary.cancelled++;
						break;
				}
				summary.totalBids += auction.bidCount;
			}

			return summary;
		},
	};
}
