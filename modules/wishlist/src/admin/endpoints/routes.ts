import { deleteWishlistItem } from "./delete-wishlist-item";
import { listAllWishlists } from "./list-all-wishlists";
import { wishlistSummary } from "./wishlist-summary";

export const adminEndpoints = {
	"/admin/wishlist": listAllWishlists,
	"/admin/wishlist/summary": wishlistSummary,
	"/admin/wishlist/:id/delete": deleteWishlistItem,
};
