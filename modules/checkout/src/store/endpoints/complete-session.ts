import { createStoreEndpoint } from "@86d-store/core/api";
import { resolveStoreStatus, storeNotAcceptingError } from "../../store-status";
import { checkoutActivationUnavailable } from "./activation-unavailable";

export const completeSession = createStoreEndpoint(
	"/checkout/sessions/:id/complete",
	{ method: "POST" },
	async (ctx) => {
		const settingsController = ctx.context.controllers.settings as
			| { getValue(key: string): Promise<string | null> }
			| undefined;
		const storeStatus = await resolveStoreStatus(settingsController);
		if (!storeStatus.accepting) {
			return storeNotAcceptingError(storeStatus);
		}

		return { ...checkoutActivationUnavailable };
	},
);
