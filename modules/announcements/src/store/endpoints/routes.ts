import { getActive } from "./get-active";
import { recordClick } from "./record-click";
import { recordDismissal } from "./record-dismissal";
import { recordImpression } from "./record-impression";

export const storeEndpoints = {
	"/announcements/active": getActive,
	"/announcements/:id/impression": recordImpression,
	"/announcements/:id/click": recordClick,
	"/announcements/:id/dismiss": recordDismissal,
};
