import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DigitalDownloadsController } from "../../service";

export const useDownload = createStoreEndpoint(
	"/downloads/:token",
	{
		method: "GET",
		params: z.object({ token: z.string().max(512) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"digital-downloads"
		] as DigitalDownloadsController;
		const result = await controller.redeemToken(ctx.params.token);
		if (!result.ok) {
			return { ok: false, reason: result.reason };
		}
		void ctx.context.events?.emit("download.accessed", {
			token: ctx.params.token,
			fileId: result.file?.id,
			fileName: result.file?.name,
		});
		return { ok: true, url: result.file?.url, file: result.file };
	},
);
