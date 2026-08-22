import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DigitalDownloadsController } from "../../service";

export const listProductFiles = createStoreEndpoint(
	"/downloads/product/:productId",
	{
		method: "GET",
		params: z.object({ productId: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"digital-downloads"
		] as DigitalDownloadsController;
		const files = await controller.listFiles({
			productId: ctx.params.productId,
		});
		// Only return active files, and exclude the actual URL (just show metadata)
		const publicFiles = files
			.filter((f) => f.isActive)
			.map((f) => ({
				id: f.id,
				name: f.name,
				fileSize: f.fileSize,
				mimeType: f.mimeType,
			}));
		return { files: publicFiles };
	},
);
