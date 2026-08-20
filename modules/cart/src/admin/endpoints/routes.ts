import { deleteCart } from "./delete-cart";
import { getCartDetails } from "./get-cart-details";
import { listAbandonedCarts } from "./list-abandoned";
import { listCarts } from "./list-carts";
import { getRecoveryStats } from "./recovery-stats";
import { sendRecoveryEmail } from "./send-recovery";

export const adminEndpoints = {
	"/admin/carts": listCarts,
	"/admin/carts/abandoned": listAbandonedCarts,
	"/admin/carts/recovery-stats": getRecoveryStats,
	"/admin/carts/:id": getCartDetails,
	"/admin/carts/:id/delete": deleteCart,
	"/admin/carts/:id/send-recovery": sendRecoveryEmail,
};
