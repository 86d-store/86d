import { getSettings } from "./get-settings";

export const adminEndpoints = {
	"/admin/stripe/settings": getSettings,
};
