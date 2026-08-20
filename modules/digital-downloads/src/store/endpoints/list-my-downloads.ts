import { createStoreEndpoint } from "@86d-app/core/api";
import type { DigitalDownloadsController } from "../../service";

export const listMyDownloads = createStoreEndpoint(
	"/downloads/me",
	{
		method: "GET",
	},
	async (ctx) => {
		const email = ctx.context.session?.user.email;
		if (!email) {
			return { error: "Unauthorized", status: 401 };
		}
		const controller = ctx.context.controllers[
			"digital-downloads"
		] as DigitalDownloadsController;
		const tokens = await controller.listTokensByEmail({ email });
		return { tokens };
	},
);
