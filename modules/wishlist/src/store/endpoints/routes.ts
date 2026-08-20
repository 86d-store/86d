import { addToWishlist } from "./add-to-wishlist";
import { bulkRemoveFromWishlist } from "./bulk-remove";
import { checkWishlist } from "./check-wishlist";
import { createWishlistShare } from "./create-share";
import { getSharedWishlist } from "./get-shared-wishlist";
import { getWishlistShares } from "./get-shares";
import { listWishlist } from "./list-wishlist";
import { removeFromWishlist } from "./remove-from-wishlist";
import { revokeWishlistShare } from "./revoke-share";
import { storeSearch } from "./store-search";

export const storeEndpoints = {
	"/wishlist/store-search": storeSearch,
	"/wishlist": listWishlist,
	"/wishlist/add": addToWishlist,
	"/wishlist/remove/:id": removeFromWishlist,
	"/wishlist/bulk-remove": bulkRemoveFromWishlist,
	"/wishlist/check/:productId": checkWishlist,
	"/wishlist/share": createWishlistShare,
	"/wishlist/shares": getWishlistShares,
	"/wishlist/share/:id/revoke": revokeWishlistShare,
	"/wishlist/shared/:token": getSharedWishlist,
};
