import { addToCart } from "./add-to-cart";
import { clearCart } from "./clear-cart";
import { getCart } from "./get-cart";
import { mergeCart } from "./merge-cart";
import { removeFromCart } from "./remove-from-cart";
import { updateCartItem } from "./update-cart-item";

export const storeEndpoints = {
	"/cart": addToCart,
	"/cart/get": getCart,
	"/cart/merge": mergeCart,
	"/cart/clear": clearCart,
	"/cart/items/:id/remove": removeFromCart,
	"/cart/items/:id/update": updateCartItem,
};
