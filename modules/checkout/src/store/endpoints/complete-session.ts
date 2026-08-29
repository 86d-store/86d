import { createStoreEndpoint } from "@86d-app/core/api";
import { checkoutActivationUnavailable } from "./activation-unavailable";

export const completeSession = createStoreEndpoint(
	"/checkout/sessions/:id/complete",
	{ method: "POST" },
	async () => ({ ...checkoutActivationUnavailable }),
);
