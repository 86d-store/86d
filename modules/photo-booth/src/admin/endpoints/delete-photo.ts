import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PhotoBoothController } from "../../service";

export const deletePhotoEndpoint = createAdminEndpoint(
	"/admin/photo-booth/photos/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.photoBooth as PhotoBoothController;
		const deleted = await controller.deletePhoto(ctx.params.id);
		return { deleted };
	},
);
