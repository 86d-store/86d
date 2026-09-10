import { createStoreEndpoint } from "@86d-store/core/api";
import { checkoutActivationUnavailable } from "./activation-unavailable";

export const completeSession = createStoreEndpoint(
	"/checkout/sessions/:id/complete",
	{ method: "POST" },
	async () => ({ ...checkoutActivationUnavailable }),
);
