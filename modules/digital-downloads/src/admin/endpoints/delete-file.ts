import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DigitalDownloadsController } from "../../service";

export const deleteFile = createAdminEndpoint(
	"/admin/downloads/files/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"digital-downloads"
		] as DigitalDownloadsController;
		const ok = await controller.deleteFile(ctx.params.id);
		return { ok };
	},
);
