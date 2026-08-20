import { buyNow } from "./buy-now";
import { getAuction } from "./get-auction";
import { listAuctions } from "./list-auctions";
import { listBids } from "./list-bids";
import { myBids } from "./my-bids";
import { myWatches } from "./my-watches";
import { placeBid } from "./place-bid";
import { unwatchAuction } from "./unwatch-auction";
import { watchAuction } from "./watch-auction";

export const storeEndpoints = {
	"/auctions": listAuctions,
	"/auctions/bids/place": placeBid,
	"/auctions/buy-now": buyNow,
	"/auctions/watch": watchAuction,
	"/auctions/unwatch": unwatchAuction,
	"/auctions/my-bids": myBids,
	"/auctions/my-watches": myWatches,
	"/auctions/:id": getAuction,
	"/auctions/:id/bids": listBids,
};
