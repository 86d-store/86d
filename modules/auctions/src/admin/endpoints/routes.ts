import { auctionSummary } from "./auction-summary";
import { cancelAuction } from "./cancel-auction";
import { closeAuction } from "./close-auction";
import { createAuction } from "./create-auction";
import { deleteAuction } from "./delete-auction";
import { getAuction } from "./get-auction";
import { listAuctions } from "./list-auctions";
import { listBids } from "./list-bids";
import { publishAuction } from "./publish-auction";
import { updateAuction } from "./update-auction";

export const adminEndpoints = {
	"/admin/auctions": listAuctions,
	"/admin/auctions/create": createAuction,
	"/admin/auctions/summary": auctionSummary,
	"/admin/auctions/:id": getAuction,
	"/admin/auctions/:id/update": updateAuction,
	"/admin/auctions/:id/delete": deleteAuction,
	"/admin/auctions/:id/publish": publishAuction,
	"/admin/auctions/:id/cancel": cancelAuction,
	"/admin/auctions/:id/close": closeAuction,
	"/admin/auctions/:id/bids": listBids,
};
