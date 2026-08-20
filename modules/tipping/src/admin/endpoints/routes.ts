import { createPayout } from "./create-payout";
import { getSettings } from "./get-settings";
import { getTip } from "./get-tip";
import { listPayouts } from "./list-payouts";
import { listTips } from "./list-tips";
import { splitTip } from "./split-tip";
import { getTipStats } from "./stats";
import { updateSettings } from "./update-settings";

export const adminEndpoints = {
	"/admin/tipping/tips": listTips,
	"/admin/tipping/tips/:id": getTip,
	"/admin/tipping/tips/:id/split": splitTip,
	"/admin/tipping/payouts": createPayout,
	"/admin/tipping/payouts/list": listPayouts,
	"/admin/tipping/stats": getTipStats,
	"/admin/tipping/settings": getSettings,
	"/admin/tipping/settings/update": updateSettings,
};
