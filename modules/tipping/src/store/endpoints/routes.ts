import { addTip } from "./add-tip";
import { getOrderTips } from "./get-order-tips";
import { getPublicSettings } from "./get-settings";
import { removeTip } from "./remove-tip";
import { updateTip } from "./update-tip";

export const storeEndpoints = {
	"/tipping/tips": addTip,
	"/tipping/tips/:id": updateTip,
	"/tipping/tips/:id/delete": removeTip,
	"/tipping/tips/order/:orderId": getOrderTips,
	"/tipping/settings": getPublicSettings,
};
