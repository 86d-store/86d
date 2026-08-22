import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { QrCodeController } from "../../service";

export const recordScanEndpoint = createStoreEndpoint(
	"/qr-codes/:id/scan",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			userAgent: z.string().max(500).optional(),
			ipAddress: z.string().max(45).optional(),
			referrer: z.string().url().max(2000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.qrCode as QrCodeController;
		const scan = await controller.recordScan(ctx.params.id, {
			userAgent: ctx.body.userAgent,
			ipAddress: ctx.body.ipAddress,
			referrer: ctx.body.referrer,
		});
		return { scan };
	},
);
