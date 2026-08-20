import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DigitalDownloadsController } from "../../service";

export const getToken = createAdminEndpoint(
	"/admin/downloads/tokens/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"digital-downloads"
		] as DigitalDownloadsController;
		const token = await controller.getToken(ctx.params.id);
		if (!token) return { error: "Token not found", status: 404 };
		return { token };
	},
);
