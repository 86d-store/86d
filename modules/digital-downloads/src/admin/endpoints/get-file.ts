import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DigitalDownloadsController } from "../../service";

export const getFile = createAdminEndpoint(
	"/admin/downloads/files/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"digital-downloads"
		] as DigitalDownloadsController;
		const file = await controller.getFile(ctx.params.id);
		if (!file) return { error: "File not found", status: 404 };
		return { file };
	},
);
