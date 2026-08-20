import { recoverCart } from "./recover-cart";
import { trackAbandoned } from "./track-abandoned";

export const storeEndpoints = {
	"/abandoned-carts/track": trackAbandoned,
	"/abandoned-carts/recover/:token": recoverCart,
};
