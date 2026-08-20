import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { auctionsStorage } from "./schema";
import { createAuctionController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export interface AuctionsOptions extends ModuleConfig {
	/**
	 * Whether anti-sniping protection is enabled by default for new auctions.
	 * @default true
	 */
	defaultAntiSniping?: boolean;

	/**
	 * Default anti-sniping extension in minutes.
	 * @default 5
	 */
	defaultAntiSnipingMinutes?: number;
}

/**
 * Auctions module factory function.
 * Enables time-limited product auctions with bidding, reserve prices, and buy-it-now.
 *
 * Three entities:
 * - Auction: the listing with type, pricing, and schedule
 * - Bid: individual bids placed by customers
 * - AuctionWatch: customers watching an auction for updates
 *
 * Auction types:
 * - English (ascending): bids go up from starting price
 * - Dutch (descending): price drops on interval until someone buys
 * - Sealed: blind bidding, highest wins when auction ends
 *
 * Lifecycle: draft -> scheduled -> active -> ended/sold/cancelled
 *
 * Features anti-sniping protection (extends end time when bids come in near close).
 *
 * Emits events for integration with notifications, orders, and payments modules.
 */
export default function auctions(options?: AuctionsOptions): Module {
	return {
		id: "auctions",
		version: "0.0.1",
		storage: auctionsStorage,

		exports: {
			read: ["auctionStatus", "currentBid", "highestBidder"],
		},

		events: {
			emits: [
				"auction.created",
				"auction.published",
				"auction.started",
				"auction.ended",
				"auction.sold",
				"auction.cancelled",
				"bid.placed",
				"bid.outbid",
				"auction.buy_now",
				"auction.extended",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createAuctionController(ctx.data);

			return {
				controllers: { auctions: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/auctions",
					component: "AuctionsList",
					label: "Auctions",
					icon: "Gavel",
					group: "Sales",
				},
				{
					path: "/admin/auctions/:id",
					component: "AuctionDetail",
				},
			],
		},

		store: {
			pages: [
				{
					path: "/auctions",
					component: "AuctionListing",
				},
				{
					path: "/auctions/:id",
					component: "AuctionPage",
				},
			],
		},

		options,
	};
}

export type {
	Auction,
	AuctionController,
	AuctionStatus,
	AuctionSummary,
	AuctionType,
	AuctionWatch,
	Bid,
	BidResult,
	BuyNowParams,
	CreateAuctionParams,
	PlaceBidParams,
	UpdateAuctionParams,
} from "./service";
