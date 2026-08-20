"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useWishlistApi() {
	const client = useModuleClient();
	return {
		listWishlist: client.module("wishlist").store["/wishlist"],
		addToWishlist: client.module("wishlist").store["/wishlist/add"],
		removeFromWishlist: client.module("wishlist").store["/wishlist/remove/:id"],
		checkWishlist:
			client.module("wishlist").store["/wishlist/check/:productId"],
	};
}
